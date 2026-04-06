# HACCPELO

 application SaaS de gestion opérationnelle destinée aux établissements de restauration (restaurants, brasseries, hôtels, cantines, dark kitchens). Elle centralise deux piliers essentiels du métier : la conformité HACCP et la gestion d'équipe.

👥 Public ciblé
Gérants / directeurs de restaurants
Responsables qualité & hygiène en restauration
Managers d'équipe en CHR (Cafés, Hôtels, Restaurants)
Franchises et groupes multi-établissements


🏗️ Architecture — 2 modules principaux

📋 Module HACCP
Écran	Fonction
Gestion DLC	Suivi des dates limites de consommation, scan code-barres, alertes produits périmés, suggestion IA de DLC
Températures	Relevés matin/midi/soir par équipement (frigos, congélateurs…), historique, alertes seuils
Nettoyage	Plan de nettoyage par zone/fréquence, validation des tâches avec horodatage et responsable
Paramètres HACCP	Gestion des équipements et des tâches de nettoyage

👥 Module Équipe
Écran	Fonction
Planning	Planning hebdomadaire drag & drop, rôles personnalisables (Runner, Cuisinier…), copie de semaine, export PDF
Pointeuse	Pointage arrivée/départ par PIN employé, historique journalier
Paramètres Équipe	Gestion du personnel (nom, heures contrat, type repas : avantage en nature / repas entreprise), rôles personnalisables, export comptable mensuel PDF avec détail horaires + repas


🔐 Sécurité & Auth
Authentification par email/mot de passe
Réinitialisation de mot de passe
RLS (Row Level Security) : chaque utilisateur ne voit que ses propres données
PIN manager pour la pointeuse


🎨 UX/UI
Design SaaS moderne avec sidebar + topbar responsive
Thème clair/sombre
Icônes Lucide, composants Shadcn/Tailwind
Responsive mobile


⚙️ Stack technique
Frontend : React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI
Backend : Lovable Cloud (auth, base de données, edge functions)
PDF : jsPDF + jspdf-autotable
IA : Suggestion de DLC via edge function


💡 Intérêt principal
Remplacer les classeurs papier HACCP et les tableaux Excel de planning par un outil numérique unique, simple, conforme aux normes d'hygiène, et qui facilite l'export des données pour le comptable.
