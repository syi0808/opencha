import { readFileSync } from 'node:fs'
import YAML from 'yaml'

describe('action metadata', () => {
  it('uses Node 24 and required inputs', () => {
    const action = YAML.parse(readFileSync('action.yml', 'utf8'))

    expect(action.runs.using).toBe('node24')
    expect(action.runs.main).toBe('dist/index.js')
    expect(action.inputs['github-token'].required).toBe(true)
    expect(action.inputs['opencha-secret'].required).toBe(true)
  })
})
