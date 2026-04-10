

## Plan : Icônes cercle coché/non coché sur la page Subscription

La page `/subscription` n'existe pas encore — elle sera créée. La seule modification par rapport au plan précédent concerne l'affichage des fonctionnalités :

### Changement demandé

Au lieu d'utiliser les icônes `Check` (vert) et `X` (gris/rouge) de lucide-react, chaque fonctionnalité sera affichée avec :

- **Incluse** : un petit cercle rempli avec une coche à l'intérieur (`CheckCircle2` de lucide-react, couleur verte `text-green-500`)
- **Exclue** : un petit cercle vide (`Circle` de lucide-react, couleur grise `text-muted-foreground`) + texte grisé (sans barré, juste `text-muted-foreground`)

Cela donne un rendu visuel plus doux et cohérent qu'un Check/X.

### Fichiers à créer / modifier

1. **`src/pages/SubscriptionPage.tsx`** (nouveau) — Page complète avec les 3 plans (Starter, Pro, Sur Mesure), grille responsive, fonctionnalités affichées avec `CheckCircle2` / `Circle`, toast au clic.

2. **`src/pages/Index.tsx`** — Ajouter la route `/subscription` avec lazy import.

3. **`src/components/AppSidebar.tsx`** — Ajouter le lien "Abonnement" avec icône `CreditCard`.

