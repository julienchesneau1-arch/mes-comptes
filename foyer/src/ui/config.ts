// Relais de synchro et d'import web (projet Supabase dédié à Foyer). null = pas de relais : synchro par lien uniquement.
// La clé est la clé publique du projet (publique par nature) : les données sont protégées par la règle RLS et le chiffrement de bout en bout.
// Si l'adresse change, mettre à jour connect-src dans index.html (un test le vérifie).
import type { RelayConf } from '../core/relay.ts';

export const RELAY: RelayConf | null = { url: 'https://ogdglcoixadgixnjtwmf.supabase.co', key: 'sb_publishable_tS8ihMgW6X1y4H6EkD-cuA_4hWlw7Fu' };
