import {useEffect, useState} from 'react'

export const useURLState = () => {
  const [state, setState] = useState({
    ra: parseFloat(new URLSearchParams(window.location.search).get('ra') || '133.794'),
    dec: parseFloat(new URLSearchParams(window.location.search).get('dec') || '-7.245'),
    fov: parseFloat(new URLSearchParams(window.location.search).get('fov') || '0.5'),
    band: parseInt(new URLSearchParams(window.location.search).get('band') || '50', 10),
    epoch: parseInt(new URLSearchParams(window.location.search).get('epoch') || '1', 10),
  })

  useEffect(() => {
    const handlePopstate = () => {
      const params = new URLSearchParams(window.location.search)
      setState({
        ra: parseFloat(params.get('ra') || '133.794'),
        dec: parseFloat(params.get('dec') || '-7.245'),
        fov: parseFloat(params.get('fov') || '0.5'),
        band: parseInt(params.get('band') || '50', 10),
        epoch: parseInt(params.get('epoch') || '1', 10),
      })
    }

    window.addEventListener('popstate', handlePopstate)

    return () => window.removeEventListener('popstate', handlePopstate)
  }, [])

  return state
}