

# Glitch Artifact — Visualiseur Audio 3D

Un visualiseur audio filaire (wireframe) au style néon, construit avec Three.js et Web Audio. Il intègre un blob (sphère) piloté par shader, une cage adaptative et des particules réactives avec une lueur (glow) en post-traitement.

## Fonctionnalités

* **Blob (Shader) :** Vagues organiques basées sur les normales, pilotées par les basses, les médiums et les aigus.
* **Cage adaptative :** Reste juste à l'extérieur du blob, se déforme davantage lorsqu'elle est dépassée par celui-ci.
* **Particules :** La teinte et l'échelle réagissent à l'audio ; harmonisées avec les couleurs choisies.
* **Post-traitement :** Bloom (éclat), léger décalage RVB et grain de film.
* **Interface de contrôle :** Sensibilité, vitesse, bloom, couleurs, fichier/micro/url, et bascule pour masquer/afficher l'interface.

## Démarrage Rapide

1. Ouvrez le dossier dans VS Code (ou tout autre éditeur).
2. Servez le dossier avec un serveur statique (les modules et import maps nécessitent le protocole http) :

```bash
# Node (recommandé)
npx serve .
# ou
npx http-server -p 8080

# Python
python -m http.server 8080

```

3. Visitez l'URL affichée (ex: `http://localhost:3000`). Utilisez Chrome ou Edge pour une meilleure compatibilité.

## Contrôles

### Lecture (Playback)

* **Play :** Active/désactive l'élément audio HTML.
* **Upload MP3 :** Choisit un fichier local.
* **Mic :** Utilise votre microphone (demande la permission).
* **Stop :** Arrête la source actuelle.
* **Audio URL + Play URL :** Charge une URL audio directe (MP3/OGG avec CORS autorisé).

### Sensibilité

* **FFT Size :** Résolution d'analyse (plus élevé = bandes plus lisses, mais plus lourd).
* **Gain :** Amplifie les niveaux de l'analyseur.
* **Reactivity :** Multiplicateur global de réactivité.
* **Déform Speed :** Échelonne le temps du shader pour accélérer/ralentir les vagues.
* **Bloom Strength / Bloom Radius :** Réglage de l'intensité et du rayon de l'éclat lumineux.

### Couleurs

* **Sphere A/B :** Couleurs de base pour le mélange du blob.
* **Cage A/B :** Couleurs alternées des fils de la cage.

### Interface (UI)

* **Hide UI :** Active/désactive l'affichage des panneaux de contrôle.
* **Mobile :** Sur les petits écrans (≤ 640px), l'UI est cachée automatiquement au chargement pour libérer la scène. Utilisez le bouton « Hide/Show UI » en bas à droite pour afficher les contrôles.

## Comportement Visuel

* **Sphère (blob)**
* Déplacement le long des normales par un bruit multi-octaves ; vitesse et amplitude modulées par l'audio.
* La couleur se mélange doucement entre les couleurs utilisateur en fonction du temps et des niveaux audio.


* **Cage**
* Tourne sur les aigus, s'adapte pour rester légèrement plus grande que le blob.
* Se déforme doucement ; augmente la déformation lorsque le blob dépasse son rayon.


* **Particules**
* Tournent et changent d'échelle avec les fréquences moyennes.
* La teinte se mélange entre *Sphere A* et *Cage B* pour une palette cohérente.



## Limitations

* **Audio distant :** Doit être un fichier audio direct avec CORS autorisé.
* Les flux YouTube, YouTube Music ou Spotify utilisent des DRM/EME ; ils ne sont pas lisibles via la balise `<audio>` pour l'analyse.


* **Microphone :** La capture du bureau ("Stereo Mix/Loopback") dépend du système d'exploitation et des pilotes ; sinon, utilisez un microphone classique.

## Dépannage

* **Page blanche ou erreurs d'import :** Servez via HTTP comme indiqué ci-dessus ; les *import maps* et modules ES ne se chargent pas depuis `file://`.
* **Pas d'audio ou lecture bloquée :** Les navigateurs nécessitent un geste utilisateur (clic) ; cliquez sur Play ; vérifiez les permissions du site.
* **Échec de l'URL distante :** Probablement un problème de CORS/DRM ; téléchargez l'audio ou hébergez-le sur un serveur avec les en-têtes CORS appropriés.
* **Performance :** Réduisez la taille FFT (*FFT Size*), réduisez la force/rayon du bloom, ou réduisez le ratio de pixels.

## Personnalisation

* **Shaders :** Les shaders vertex et fragment du blob sont définis dans `main.js` (uniforms : `u_time`, `u_bass`, `u_mid`, `u_treble`, `u_reactivity`, `u_speed`, `u_color`).
* **Couleurs :** Mettez à jour via l'interface ou définissez les valeurs par défaut dans `main.js` (`userColors`).
* **Post-traitement :** Ajustez les paramètres `UnrealBloom` dans `main.js`.

## Structure des Fichiers

* `index.html` — Interface utilisateur, import map, et amorçage des modules.
* `style.css` — Style néon/CRT et mise en page de l'interface.
* `main.js` — Pipeline audio, configuration de la scène, shaders, boucle d'animation.

## Licence & Contenu

Ce visualiseur est destiné à un usage personnel ou éducatif. Ne diffusez ou n'analysez que l'audio dont vous détenez les droits. Respectez les conditions d'utilisation des plateformes et le droit d'auteur.

