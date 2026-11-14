import React, {useState, useEffect} from 'react'
import CoordinateInput from './components/CoordinateInput'
import ImageViewer from './components/ImageViewer'
import BandSelector from './components/BandSelector'
import TimeLapseControls from './components/TimeLapseControls'
import OverlayControls from './components/OverlayControls'
import SpectrumPlot from './components/SpectrumPlot'
import TestObjectsPreset from './components/TestObjectsPreset'
import { useURLState } from './hooks/useURLState'
import { useSPHERExData } from './hooks/useSPHERExData'

function App() {
  const [urlState, setURLState] = useURLState()
  const {
    imageData,
    loading,
    error,
    fetchEpochImage,
    currentEpoch,
    setCurrentEpoch,
    availableEpochs,
    bands,
    setBand,
    spectrumData,
    setSpectrumData,
  } = useSPHERExData()

  // URL parameter handling and sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ra = parseFloat(params.get('ra') || '133.794')
    const dec = parseFloat(params.get('dec') || '-7.245')
    const fov = parseFloat(params.get('fov') || '0.5')
    const band = parseInt(params.get('band') || '50', 10)
    const epoch = parseInt(params.get('epoch') || '1', 10)

    setURLState({ra, dec, fov, band, epoch})

    // Fetch data when coordinates change
    fetchEpochImage(ra, dec, fov, band, epoch)
  }, [fetchEpochImage, setURLState])

  // Sync URL state when internal state changes
  useEffect(() => {
    const params = new URLSearchParams()
    params.append('ra', urlState.ra?.toString() || '')
    params.append('dec', urlState.dec?.toString() || '')
    params.append('fov', urlState.fov?.toString() || '')
    params.append('band', urlState.band?.toString() || '')
    params.append('epoch', urlState.epoch?.toString() || '')
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.pushState({path: newUrl}, '', newUrl)
  }, [urlState])

  if (loading && !imageData) {
    return (
      <div style={{minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div>Loading SPHEREx data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{minHeight: '400px', padding: '20px', textAlign: 'center'}}>
        <h3>Error loading data</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  return (
    <div style={{padding: '20px', maxWidth: '1400px', margin: '0 auto'}}>
      <header style={{marginBottom: '20px', textAlign: 'center'}}>
        <h1 style={{margin: '0', fontSize: '2rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', '-webkit-background-clip: text', '-webkit-text-fill-color: transparent'}}>
          SPHEREx Planet X Viewer
        </h1>
        <p style={{margin: '5px 0 0', color: '#64748b', fontSize: '1rem'}}>
          Discover moving astronomical objects in SPHEREx infrared data
        </p>
      </header>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
        {/* Left panel: Controls */}
        <div>
          <CoordinateInput
            ra={urlState.ra}
            dec={urlState.dec}
            fov={urlState.fov}
            onRAChange={setURLState}
            onDecChange={setURLState}
            onFOVChange={setURLState}
          />

          <BandSelector
            band={urlState.band}
            onBandChange={setBand}
            availableBands={bands}
          />

          <TestObjectsPreset
            onPresetSelect={(ra, dec) => {
              setURLState({ra, dec, fov: urlState.fov, band: urlState.band, epoch: urlState.epoch})
              fetchEpochImage(ra, dec, urlState.fov, urlState.band, urlState.epoch)
            }}
          />
        </div>

        {/* Right panel: Overlays and controls */}
        <div>
          <OverlayControls
            ra={urlState.ra}
            dec={urlState.dec}
            fov={urlState.fov}
            onToggleGaia={}
            onToggleWISE={}
          />

          <TimeLapseControls
            epochs={availableEpochs}
            currentEpoch={currentEpoch}
            onEpochChange={setCurrentEpoch}
            onStepForward={() => fetchEpochImage(urlState.ra, urlState.dec, urlState.fov, urlState.band, currentEpoch + 1)}
            onStepBackward={() => fetchEpochImage(urlState.ra, urlState.dec, urlState.fov, urlState.band, currentEpoch - 1)}
            onSpeedChange={}
          />
        </div>
      </div>

      {/* Image viewer area */}
      <ImageViewer
        image={imageData}
        loading={loading}
        error={error}
        fov={urlState.fov}
        onEpochImageFetch={fetchEpochImage}
        currentEpoch={currentEpoch}
        bands={bands}
        setBand={setBand}
        spectrumData={spectrumData}
        setSpectrumData={setSpectrumData}
      />

      {/* Spectrum plot (bottom) */}
      {spectrumData && spectrumData.bands.length > 0 && (
        <SpectrumPlot data={spectrumData} />
      )}
    </div>
  )
}

export default App