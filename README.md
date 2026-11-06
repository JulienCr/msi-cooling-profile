# MSI Cooling (Stream Deck)

Plugin Stream Deck qui fait défiler les profils de ventilation de la carte mère dans MSI Center (Cooling Wizard) depuis une seule touche.

- Une touche, l'action « Cycle profil ventilation » : chaque appui passe au profil suivant parmi ceux cochés dans l'inspecteur (Profil 1 à 5, ordre croissant, retour au début).
- La touche affiche une petite icône de ventilateur et le numéro du profil actif. Elle est grisée si le profil actif n'est pas dans la liste du cycle, et affiche « — » si MSI Center n'est pas joignable.
- Elle reste synchronisée quand le profil change ailleurs (interface MSI Center, par exemple) : un seul sondage du registre toutes les 2 s, seulement tant qu'une touche est visible.

## Installation

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm validate
pnpm sd:link        # lie le plugin à Stream Deck
pnpm sd:restart     # relance le plugin après un rebuild
```

Les icônes statiques se régénèrent avec `pnpm icons`.

Journaux : `com.juliencr.msi-cooling.sdPlugin/logs/`.

## À savoir

- **MSI Center (`DCv2.exe`) doit tourner.** Le serveur central ne fait que relayer la commande ; c'est l'interface qui charge et applique les courbes. Sans elle, le plugin n'envoie rien et la touche signale une erreur.
- Le protocole est issu de la rétro-ingénierie de MSI Center 2.0.75. Une mise à jour de MSI Center peut le casser : [NOTES.md](NOTES.md) détaille le protocole et la méthode pour le retrouver.
- Le script `Set-CoolingProfile.ps1` fait la même chose en ligne de commande et sert de référence du protocole.
