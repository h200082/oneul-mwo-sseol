import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MENU_NARRATION_AUDIO_IDS } from '../src/data/menuNarrationAudioIds'
import {
  MENU_NARRATION_AUDIO_URLS,
  getMenuNarrationAudioUrl,
} from '../src/data/menuNarrationAudioManifest'
import { MENU_NARRATIONS } from '../src/data/menuNarrations'

const STALE_DEFAULT_MP3_IDS = ['pasta'] as const

describe('static narration audio eligibility', () => {
  it('exposes all fifty copy-matched runtime assets', () => {
    expect(MENU_NARRATION_AUDIO_IDS).toHaveLength(50)
    expect(Object.keys(MENU_NARRATION_AUDIO_URLS)).toEqual(
      MENU_NARRATION_AUDIO_IDS,
    )
    expect(
      MENU_NARRATIONS.filter(({ audioUrl }) => audioUrl !== null),
    ).toHaveLength(50)
    expect(
      MENU_NARRATIONS.filter(({ audioUrl }) => audioUrl === null),
    ).toHaveLength(0)
  })

  it('keeps stale historical MP3 files orphaned from runtime playback', () => {
    const manifestSource = readFileSync(
      resolve(process.cwd(), 'src/data/menuNarrationAudioManifest.ts'),
      'utf8',
    )

    for (const menuId of STALE_DEFAULT_MP3_IDS) {
      expect(MENU_NARRATION_AUDIO_IDS).toContain(menuId)
      expect(getMenuNarrationAudioUrl(menuId)).toMatch(
        /pasta-final-tiebreak\.mp3(?:\?|$)/,
      )
      expect(
        MENU_NARRATIONS.find(({ menuId: candidate }) => candidate === menuId)
          ?.audioUrl,
      ).toBe(getMenuNarrationAudioUrl(menuId))
      expect(
        existsSync(
          resolve(process.cwd(), `src/assets/narration/${menuId}.mp3`),
        ),
      ).toBe(true)
      expect(manifestSource).not.toContain(
        `../assets/narration/${menuId}.mp3`,
      )
    }
  })

  it('keeps the historical gomtang MP3 orphaned while activating the approved WAV', () => {
    const manifestSource = readFileSync(
      resolve(process.cwd(), 'src/data/menuNarrationAudioManifest.ts'),
      'utf8',
    )
    expect(MENU_NARRATION_AUDIO_IDS).toContain('gomtang')
    expect(getMenuNarrationAudioUrl('gomtang')).toMatch(/\.wav(?:\?|$)/)
    expect(existsSync(resolve(process.cwd(), 'src/assets/narration/gomtang.mp3'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'src/assets/narration/gomtang.wav'))).toBe(true)
    expect(manifestSource).toContain("../assets/narration/gomtang.wav")
    expect(manifestSource).not.toContain("../assets/narration/gomtang.mp3")
  })

  it('enables only the approved final-tiebreak bulgogi-deopbap take', () => {
    expect(MENU_NARRATION_AUDIO_IDS).toContain('bulgogi-deopbap')
    expect(getMenuNarrationAudioUrl('bulgogi-deopbap')).toMatch(
      /bulgogi-deopbap-final-tiebreak\.mp3(?:\?|$)/,
    )
    expect(
      MENU_NARRATIONS.find(({ menuId }) => menuId === 'bulgogi-deopbap')
        ?.audioUrl,
    ).toBe(getMenuNarrationAudioUrl('bulgogi-deopbap'))
  })
})
