import {useState, useEffect, useCallback} from 'react'

export const useSPHERExData = () => {
  const [imageData, setImageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentEpoch, setCurrentEpoch] = useState(1)
  const [availableEpochs, setAvailableEpochs] = useState([])
  const [bands, setBands] = useState(Array.from({length: 102}, (_, i) => i + 1))
  const [spectrumData, setSpectrumData] = useState(null)

  const fetchEpochImage = useCallback(
    async (ra, dec, fov, band, epoch) => {
      setLoading(true)
      setError(null)

      try {
        // Fetch the cutout image
        const imageResponse = await fetch(
          `/api/spherex/cutout?ra=${ra}&dec=${dec}&fov=${fov}&band=${band}&epoch=${epoch}`,
          {cache: 'no-cache'}
        )

        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}`)
        }

        const imageData = await imageResponse.json()

        // Fetch available epochs
        const epochsResponse = await fetch(
          `/api/spherex/epochs?ra=${ra}&dec=${dec}&fov=${fov}&band=${band}`,
          {cache: 'no-cache'}
        )

        if (!epochsResponse.ok) {
          throw new Error(`HTTP ${epochsResponse.status}`)
        }

        const epochsData = await epochsResponse.json()

        setImageData(imageData)
        setAvailableEpochs(epochsData.epochs || [])
        setCurrentEpoch(epoch)
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch SPHEREx data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      }
    },
    [setImageData, setAvailableEpochs, setCurrentEpoch],
  )

  const fetchSpectrum = useCallback(
    async (ra, dec, fov, band) => {
      setLoading(true)
      setError(null)

      try {
        // In a full implementation, this would extract spectrum data
        // from the SPHEREx cutout at the clicked position
        // For now, generate synthetic spectrum data
        const nBands = 102
        const wavelengths = Array.from(
          {length: nBands},
          (_, i) => getBandWavelength(i + 1),
        )
        const fluxes = Array.from({length: nBands}, () =>
          Math.max(0, Math.random() * 10),
        )
        const snrs = Array.from({length: nBands}, () =>
          Math.floor(Math.random() * 50 + 10),
        )

        setSpectrumData({
          bands: wavelengths,
          fluxes,
          snrs,
          objectPosition: {ra, dec},
        })
        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch spectrum:', err)
        setError(err instanceof Error ? err.message : 'Failed to load spectrum')
        setLoading(false)
      }
    },
    [],
  )

  return {
    imageData,
    loading,
    error,
    fetchEpochImage,
    currentEpoch,
    setCurrentEpoch,
    availableEpochs,
    bands,
    setBand: useCallback((band) => {}, []), // Placeholder - actual state managed in App
    spectrumData,
    setSpectrumData,
    fetchSpectrum,
  }
}

// Helper function for wavelength lookup
function getBandWavelength(band) {
  const MIN_WAVELENGTH = 0.75
  const MAX_WAVELENGTH = 5.0
  return round(
    MIN_WAVELENGTH + (MAX_WAVELENGTH - MIN_WAVELENGTH) * (band - 1) / (102 - 1),
    3,
  )
}

function round(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}