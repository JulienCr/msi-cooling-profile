# Notes de rétro-ingénierie

Comment MSI Center change de profil de ventilation, et comment on le rejoue sans toucher à l'interface.

Relevé le 2026-11-06 sur :

| | |
|---|---|
| Carte mère | MSI MAG Z790 TOMAHAWK WIFI (MS-7D91), BIOS H.H0 |
| MSI Center (paquet MSIX) | 2.0.75 (`DCv2.exe` 2.0.107, SDK 3.2026.1013) |
| OS | Windows 11 |

Méthode : décompilation .NET (`ilspycmd`) des binaires du backend et des modules d'interface, lecture du registre et des journaux, puis test réel de la commande. Aucun binaire MSI n'a été modifié.

## Vue d'ensemble

```
Stream Deck / script
        │  TCP 127.0.0.1:32683  (trame de 13 octets)
        ▼
MSI.CentralServer.exe ── écrit CurIndex dans le registre
        │  TCP 127.0.0.1:33683  (canal « Sync » vers l'interface)
        ▼
DCv2.exe (interface MSI Center, module « UC_Cooling Wizard »)
        │  charge le profil depuis CW_Data, applique les courbes
        ▼
CC_Engine_x64.exe ── pipe \\.\pipe\MSI_CC_Engine
        │
        ▼
NTIOLib_X64.sys (service NTIOLib_CC_COMM) ── Super I/O Nuvoton NCT6687D
```

Le point clé : **le serveur central ne fait que relayer**. C'est l'interface (`DCv2.exe`) qui lit les courbes du profil et les envoie au moteur. Si elle n'est pas lancée, le profil actif change dans le registre mais rien n'est appliqué au matériel.

## Processus et canaux

| Processus | Rôle | Canal |
|---|---|---|
| `MSI.CentralServer.exe` | Reçoit les commandes | écoute `127.0.0.1:<Server Port>` (32683) |
| `MSI.CentralServer.exe` | Pousse les événements vers l'interface | `127.0.0.1:<SyncServer Port>` (33683) |
| `MSI.TerminalServer.exe` | Non étudié | écoute `127.0.0.1:26822` |
| `DCv2.exe` | Interface, applique les profils | client du port Sync |
| `CC_Engine_x64.exe` | Moteur matériel natif | pipe `\\.\pipe\MSI_CC_Engine` |

Les ports sont stockés dans `HKLM\SOFTWARE\WOW6432Node\MSI\MSI Center\Component\SDK` (valeurs `Server Port` et `SyncServer Port`). Il faut les relire à chaque appel : ils peuvent changer quand MSI Center redémarre.

Il n'y a aucune authentification : le serveur vérifie seulement que la connexion vient de la boucle locale. Les droits administrateur ne sont pas nécessaires.

## Protocole

Défini dans `CS_CommonAPI.dll` (`C_Client.SendData`, `C_Server.Callback_Read`).

Chaque commande ouvre une connexion TCP courte, envoie la charge utile, lit la réponse, puis ferme la connexion.

```
[int32 little-endian : DestID] [octets de commande...]
```

- `DestID = 9999` désigne le serveur central.
- Le client officiel peut préfixer un en-tête de 24 octets (avec un « magic » de 16 octets) quand il a un `SourceID > 0`. La forme courte à 4 octets est acceptée sans en-tête.

### Changer de profil

Commande `CMD_CoolingWizard_ChangeProfile`, suivie d'un octet d'index (base 0) :

```
0F 27 00 00   05 03 01 08 00 00 0A 01   <index>
└─ 9999 ──┘   └──── commande ────────┘   0..4 = Profil 1..5
```

Réponse attendue : un seul octet `01`.

Exemple pour « Profil 3 » : `0F 27 00 00 05 03 01 08 00 00 0A 01 02`.

Ce qui se passe côté serveur (`MSI.CentralServer`, `C_Features.DataResponse`) :
1. Lecture de l'ID du composant dans `Component\Cooling Wizard\ID` (3001 ici).
2. Écriture de `Component\Cooling Wizard\<SID>\CurIndex`, `CurUserSID` et d'un horodatage `Refresh`.
3. Relais vers l'interface : `EX_SyncClient.SendToUI(9999, 3001, cmd, [index])`.

Côté interface (`UC_Cooling Wizard.dll`, `PluginClass.Transfer_Command`) :
1. `MainUI.VerifyChangeProfile("ExternalChangeProfileAlert", index)`. S'il y a des modifications non sauvegardées, une alerte s'affiche à la place du changement.
2. `ChangeProfile()` → `Transfer_ToModule(module, "ChangeProfile", index)`.
3. `UC_User Scenario.dll` lit le profil dans `CW_Data`, envoie `CMD_CoolingWizardUpdate`, met à jour le mode, et appelle `Apply()` si le profil est en mode Custom (3).

Un clic sur un onglet de profil dans l'interface suit exactement le même chemin : l'interface envoie elle-même cette commande au serveur (`MainUI.cs`).

### Autres commandes repérées (non utilisées)

| Commande | Octets | Charge |
|---|---|---|
| `CMD_CoolingWizard_ChangeNames` | `05 03 01 08 00 00 0A 02` | noms des profils joints par `\n` |
| Commandes moteur (relayées vers `API_Engine.dll`) | préfixe `05 03 01 08 01 00 01 01` + ASCII | `SetFanModebyCoolingWizard;<1\|2\|3>;`, `SetManualFAN;<fanId>;<duty>;`, `SetSmartFAN;<fanId>;<T;D;...>` |

Les commandes moteur pilotent les ventilateurs directement, mais elles court-circuitent l'état des profils, et l'interface peut écraser leur effet. C'est pourquoi on ne les utilise pas.

## Où sont les données

Toutes les clés ci-dessous sont sous `HKLM\SOFTWARE\WOW6432Node\MSI\MSI Center\`.

| Donnée | Emplacement |
|---|---|
| Profil actif (base 0) | `Component\Cooling Wizard\<SID>\CurIndex` (DWORD) |
| SID de l'utilisateur courant | `Component\Cooling Wizard\CurUserSID` |
| Noms des profils | `Component\Cooling Wizard\<SID>\ProfileNames` (REG_MULTI_SZ) |
| Courbes des 5 profils | `Component\Engine\CW_Data`, valeur nommée d'après l'utilisateur Windows (JSON) |
| Dernier mode appliqué | `Component\Engine\CoolingWizardMode` (1 Silent, 2 Performance, 3 Custom) |
| Copie côté interface | `C:\ProgramData\MSI\MSI Center\Cooling Wizard\Settings.dat` (`CurProfile`, `ProfileNames`) |

`CW_Data` contient, pour chaque profil : `CurMode[15]`, `CurManualDuty[15]`, `SmartFAN_Info[15]` (courbes en base64), `CurFan_TempID[15]`, `US_Mode` et `ChipsetFan_Mode`.

## Le lien `msi-mc:`

Le manifeste MSIX enregistre le protocole `msi-mc`. `DCv2` (`App.cs`, `OnStartup`) découpe `msi-mc:<page>[:<page2>]` et l'associe à l'énumération `EnumURIProtocol` (`cooling wizard` = 33). Le lien ouvre seulement la page correspondante : il n'existe pas de paramètre pour choisir ou appliquer un profil.

## Test réel

Commande envoyée avec un index identique au profil actif, puis 1 → 0, puis 0 → 1 :

- La réponse est toujours `01`.
- Sur un changement effectif, `CurIndex`, `Settings.dat` et `CoolingWizardMode` changent. Le journal `C:\ProgramData\MSI\MSI Center\Case\Log\Log_CoolingWizard_*.log` affiche `[Notify] Change profile as N`, `Apply profile settings.`, puis `[ChangeProfile] Change profile success.`
- `Apply success : True` apparaît plus tard dans `User Scenario\User Scenario_<date>.txt`.
- Si l'index est celui du profil déjà actif, la commande ne laisse aucune trace : rien dans les journaux, rien dans le registre.
- Le changement s'entend sur les ventilateurs et se voit dans l'interface, où l'onglet actif suit.

## Pièges

- **Modifier `CurIndex` dans le registre ne fait rien.** Il faut passer par le serveur pour que l'interface soit prévenue.
- **Le module « Case » est un leurre** sur cette carte. Il n'est pas supporté ici, mais il écrit dans `Case\Log\` des profils `Profile0..4`, tous en « Silent ». Ce ne sont pas les vraies courbes de la carte mère, qui sont dans `CW_Data`.
- **Une modification non sauvegardée dans l'interface** fait afficher une alerte au lieu de changer de profil.
- **Les octets dépendent de la version.** Une mise à jour de MSI Center peut changer les commandes ou les ports.

## Refaire l'analyse après une mise à jour

1. Copier les binaires hors du dossier d'installation :
   - `C:\Program Files (x86)\MSI\MSI Center\MSI.CentralServer.exe` et `CS_CommonAPI.dll`
   - `UC_Cooling Wizard.dll` et `UC_User Scenario.dll`, modules de l'interface, dans le paquet MSIX : `C:\Program Files\WindowsApps\9426MICRO-STARINTERNATION.MSICenter_*\DCv2\`
2. Les décompiler : `dotnet tool install -g ilspycmd`, puis `ilspycmd -p -o out\<nom> <binaire>`.
3. Chercher `CMD_CoolingWizard_ChangeProfile` dans `DataCenter.cs` (interface) et `C_Features.cs` (serveur), et comparer les octets.
4. Vérifier les ports dans `Component\SDK`.
5. Tester avec `Set-CoolingProfile.ps1` en surveillant `Log_CoolingWizard_*.log`.
