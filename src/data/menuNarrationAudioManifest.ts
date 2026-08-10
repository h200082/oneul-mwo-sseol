import type { MenuNarrationAudioId } from './menuNarrationAudioIds'

export { MENU_NARRATION_AUDIO_IDS } from './menuNarrationAudioIds'
export type { MenuNarrationAudioId } from './menuNarrationAudioIds'
import budaeJjigaeNarrationUrl from '../assets/narration/budae-jjigae.mp3'
import bibimbapNarrationUrl from '../assets/narration/bibimbap.mp3'
import bibimGuksuNarrationUrl from '../assets/narration/bibim-guksu-remaining-batch-01.mp3'
import bossamNarrationUrl from '../assets/narration/bossam-remaining-batch-01.mp3'
import bulgogiDeopbapNarrationUrl from '../assets/narration/bulgogi-deopbap-final-tiebreak.mp3'
import bulgogiNarrationUrl from '../assets/narration/bulgogi-remaining-batch-01.mp3'
import chickenMayoDeopbapNarrationUrl from '../assets/narration/chicken-mayo-deopbap.mp3'
import cheonggukjangNarrationUrl from '../assets/narration/cheonggukjang.mp3'
import curryRiceNarrationUrl from '../assets/narration/curry-rice-remaining-batch-01.mp3'
import dakHanmariNarrationUrl from '../assets/narration/dak-hanmari-remaining-batch-01.mp3'
import dakgalbiNarrationUrl from '../assets/narration/dakgalbi-remaining-batch-01.mp3'
import doenjangJjigaeNarrationUrl from '../assets/narration/doenjang-jjigae.mp3'
import dwaejiGukbapNarrationUrl from '../assets/narration/dwaeji-gukbap.mp3'
import friedRiceNarrationUrl from '../assets/narration/fried-rice-remaining-batch-01.mp3'
import friedChickenNarrationUrl from '../assets/narration/fried-chicken-remaining-batch-01.mp3'
import galbitangNarrationUrl from '../assets/narration/galbitang.mp3'
import gamjatangNarrationUrl from '../assets/narration/gamjatang.mp3'
import gimbapNarrationUrl from '../assets/narration/gimbap-remaining-batch-01.mp3'
import gomtangNarrationUrl from '../assets/narration/gomtang.wav'
import grilledGalbiNarrationUrl from '../assets/narration/grilled-galbi-remaining-batch-01.mp3'
import hamburgerNarrationUrl from '../assets/narration/hamburger-fast-repeat-trim.wav'
import homeStyleBaekbanNarrationUrl from '../assets/narration/home-style-baekban.mp3'
import janchiGuksuNarrationUrl from '../assets/narration/janchi-guksu-remaining-batch-01.mp3'
import jeyukDeopbapNarrationUrl from '../assets/narration/jeyuk-deopbap.mp3'
import jjajangmyeonNarrationUrl from '../assets/narration/jjajangmyeon-remaining-batch-01.mp3'
import jjamppongNarrationUrl from '../assets/narration/jjamppong-remaining-batch-01.mp3'
import jokbalNarrationUrl from '../assets/narration/jokbal-copy-retake-01.mp3'
import kalguksuNarrationUrl from '../assets/narration/kalguksu-copy-retake-01.mp3'
import kimchiFriedRiceNarrationUrl from '../assets/narration/kimchi-fried-rice.wav'
import kimchiJjigaeNarrationUrl from '../assets/narration/kimchi-jjigae.mp3'
import kongnamulGukbapNarrationUrl from '../assets/narration/kongnamul-gukbap.mp3'
import koreanToastNarrationUrl from '../assets/narration/korean-toast-remaining-batch-01.mp3'
import naengmyeonNarrationUrl from '../assets/narration/naengmyeon-remaining-batch-01.mp3'
import omuriceNarrationUrl from '../assets/narration/omurice-remaining-batch-01.mp3'
import pastaNarrationUrl from '../assets/narration/pasta-final-tiebreak.mp3'
import phoNarrationUrl from '../assets/narration/pho-remaining-batch-01.mp3'
import porkCutletNarrationUrl from '../assets/narration/pork-cutlet-remaining-batch-01.mp3'
import pizzaNarrationUrl from '../assets/narration/pizza-remaining-batch-01.mp3'
import ramyeonNarrationUrl from '../assets/narration/ramyeon.mp3'
import samgyeopsalNarrationUrl from '../assets/narration/samgyeopsal-remaining-batch-01.mp3'
import samgyetangNarrationUrl from '../assets/narration/samgyetang.mp3'
import sandwichNarrationUrl from '../assets/narration/sandwich-remaining-batch-01.mp3'
import seolleongtangNarrationUrl from '../assets/narration/seolleongtang.mp3'
import shabuShabuNarrationUrl from '../assets/narration/shabu-shabu.wav'
import sundaeGukNarrationUrl from '../assets/narration/sundae-guk.mp3'
import sundubuJjigaeNarrationUrl from '../assets/narration/sundubu-jjigae.mp3'
import sushiNarrationUrl from '../assets/narration/sushi-remaining-batch-01.mp3'
import tteokbokkiNarrationUrl from '../assets/narration/tteokbokki-onset-retake-b.mp3'
import udonNarrationUrl from '../assets/narration/udon-remaining-batch-01.mp3'
import yukgaejangNarrationUrl from '../assets/narration/yukgaejang.mp3'

export const MENU_NARRATION_AUDIO_URLS: Readonly<
  Record<MenuNarrationAudioId, string>
> = Object.freeze({
  'kimchi-jjigae': kimchiJjigaeNarrationUrl,
  'doenjang-jjigae': doenjangJjigaeNarrationUrl,
  'sundubu-jjigae': sundubuJjigaeNarrationUrl,
  'budae-jjigae': budaeJjigaeNarrationUrl,
  gamjatang: gamjatangNarrationUrl,
  seolleongtang: seolleongtangNarrationUrl,
  gomtang: gomtangNarrationUrl,
  galbitang: galbitangNarrationUrl,
  yukgaejang: yukgaejangNarrationUrl,
  samgyetang: samgyetangNarrationUrl,
  'kongnamul-gukbap': kongnamulGukbapNarrationUrl,
  'dwaeji-gukbap': dwaejiGukbapNarrationUrl,
  'sundae-guk': sundaeGukNarrationUrl,
  cheonggukjang: cheonggukjangNarrationUrl,
  'home-style-baekban': homeStyleBaekbanNarrationUrl,
  bibimbap: bibimbapNarrationUrl,
  'jeyuk-deopbap': jeyukDeopbapNarrationUrl,
  'bulgogi-deopbap': bulgogiDeopbapNarrationUrl,
  'chicken-mayo-deopbap': chickenMayoDeopbapNarrationUrl,
  'curry-rice': curryRiceNarrationUrl,
  omurice: omuriceNarrationUrl,
  'fried-rice': friedRiceNarrationUrl,
  'kimchi-fried-rice': kimchiFriedRiceNarrationUrl,
  'pork-cutlet': porkCutletNarrationUrl,
  sushi: sushiNarrationUrl,
  'bibim-guksu': bibimGuksuNarrationUrl,
  'janchi-guksu': janchiGuksuNarrationUrl,
  kalguksu: kalguksuNarrationUrl,
  naengmyeon: naengmyeonNarrationUrl,
  jjajangmyeon: jjajangmyeonNarrationUrl,
  jjamppong: jjamppongNarrationUrl,
  ramyeon: ramyeonNarrationUrl,
  udon: udonNarrationUrl,
  pasta: pastaNarrationUrl,
  pho: phoNarrationUrl,
  tteokbokki: tteokbokkiNarrationUrl,
  gimbap: gimbapNarrationUrl,
  sandwich: sandwichNarrationUrl,
  hamburger: hamburgerNarrationUrl,
  'korean-toast': koreanToastNarrationUrl,
  samgyeopsal: samgyeopsalNarrationUrl,
  'grilled-galbi': grilledGalbiNarrationUrl,
  dakgalbi: dakgalbiNarrationUrl,
  bossam: bossamNarrationUrl,
  jokbal: jokbalNarrationUrl,
  bulgogi: bulgogiNarrationUrl,
  'fried-chicken': friedChickenNarrationUrl,
  pizza: pizzaNarrationUrl,
  'dak-hanmari': dakHanmariNarrationUrl,
  'shabu-shabu': shabuShabuNarrationUrl,
})

export function getMenuNarrationAudioUrl(menuId: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(MENU_NARRATION_AUDIO_URLS, menuId)) {
    return null
  }
  return MENU_NARRATION_AUDIO_URLS[menuId as MenuNarrationAudioId]
}
