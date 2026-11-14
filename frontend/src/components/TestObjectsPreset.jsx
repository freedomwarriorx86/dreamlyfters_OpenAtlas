import React, {useState} from 'react'

const testObjects = [
  {
    name: "Barnard's Star",
    ra: 269.452,
    dec: 4.693,
    description: "Fast proper motion star"
  },
  {
    name: "Epsilon Indi B",
    ra: 330.840,
    dec: -56.786,
    description: "Brown dwarf pair"
  },
  {
    name: "WISE 0855",
    ra: 133.794,
    dec: -7.245,
    description: "Fastest known brown dwarf"
  },
  {
    name: "RW Aurigae",
    ra: 84.553,
    dec: 30.401,
    description: "Variable star"
  },
  {
    name: "R Draconis",
    ra: 276.047,
    dec: 68.039,
    description: "Variable star"
  }
]

export const TestObjectsPreset = ({onPresetSelect}) => {
  const [selected, setSelected] = useState(testObjects[0])

  return (
    <div style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
      <h4 style={{margin: '0 0 12px', color: '#374151'}}>
        Test Objects
      </h4>
      <select
        value={selected.name}
        onChange={(e) => {
          const obj = testObjects.find(o => o.name === e.target.value) || testObjects[0]
          setSelected(obj)
          onPresetSelect(obj.ra, obj.dec)
        }}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #cbd5e0',
          borderRadius: '4px',
          background: 'white',
          fontSize: '0.875rem'
        }}
      >
        {testObjects.map(obj => (
          <option key={obj.name} value={obj.name}>
            {obj.name} (RA: {obj.ra}, Dec: {obj.dec})
          </option>
        ))}
      </select>
      <p style={{margin: '8px 0 0', fontSize: '0.75rem', color: '#64748b'}}>
        {selected.description}
      </p>
    </div>
  )
}