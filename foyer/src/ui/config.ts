// Relais de synchro et d'import web (projet Supabase dédié à Foyer). null = pas de relais : synchro par lien uniquement.
// La clé est la clé publique (« anon ») : l'accès aux données est protégé par la règle RLS et par le chiffrement de bout en bout.
// Si l'adresse change, mettre à jour connect-src dans index.html (un test le vérifie).
import type { RelayConf } from '../core/relay.ts';

export const RELAY: RelayConf | null = null;
