/// <reference lib="webworker" />
// Le métronome de l'hôte d'une partie en ligne. Un onglet en arrière-plan ralentit ses minuteries jusqu'à une
// par seconde, voire moins ; celles d'un Worker continuent de battre, et la partie ne ralentit pour personne.
let timer = 0

self.onmessage = (e: MessageEvent<number>) => {
  clearInterval(timer)
  if (e.data > 0) timer = self.setInterval(() => (self as unknown as Worker).postMessage(0), e.data)
}
