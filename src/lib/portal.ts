// Contato do portal do cliente.
// TODO(fase posterior): ler de app_settings (configurável em Configurações),
// permitindo número/e-mail por ambiente sem novo deploy.
const WHATSAPP_NUMBER = '5551999999999'; // placeholder — ajustar para o número oficial
const CONTACT_EMAIL = 'contato@coffeelier.com.br';

export const PORTAL_WHATSAPP_URL =
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Falo pelo portal Coffeelier e gostaria de ajuda com um pedido.')}`;

export const PORTAL_CONTACT_EMAIL = CONTACT_EMAIL;
