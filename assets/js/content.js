/* ============================================================
   DANI BOSS — CONTENIDO EDITABLE
   Todo lo que cambia con frecuencia vive aquí:
   contacto, precios, testimonios y mensajes de WhatsApp.
   ============================================================ */
window.DB_CONTENT = {
  contact: {
    whatsapp: '593959639787',            // sin "+" ni espacios
    whatsappDisplay: '+593 959 639 787',
    calendly: 'https://calendly.com/thedaniiboss/llamada-de-diagnostico-dani-boss',
    instagram: 'https://instagram.com/thedaniiboss'
  },

  // Mensajes prellenados según el botón que se toque
  waMessages: {
    nav:     'Hola Dani, vi tu web y quiero más información.',
    hero:    'Hola Dani, vi tu web y quiero construir un sistema para mi negocio.',
    closing: 'Hola Dani, quiero hablar de mi proyecto.',
    float:   'Hola Dani, vi tu web y tengo una pregunta.',
    video:   'Hola Dani, vi tu video en la web. Mi problema es: ',
    diagnostico: 'Hola Dani, quiero el diagnóstico de $33. Mi negocio es: ',
    fundador:    'Hola Dani, quiero uno de los cupos fundadores del diagnóstico (pago después + testimonio). Mi negocio es: '
  },

  /* Cupos fundadores del diagnóstico: pagan después si les sirvió, a cambio de testimonio.
     Cuando entre uno, sube "tomados". Al llegar al total, el bloque se oculta solo. */
  founders: { total: 5, tomados: 0 },

  // Precios vigentes (fuente: Escalera de Valor DANI BOSS × MAGNA)
  prices: {
    diagnostico: { from: '$33',    note: 'pago único' },
    sistema:     { from: '$500',   note: 'al mes' },
    crecimiento: { from: '$1,500', note: 'por proyecto' }
  },

  /* Testimonios REALES. Agrega objetos así y la sección aparece sola:
     { texto: 'Lo que dijo el cliente', nombre: 'Nombre', marca: 'Negocio · Ciudad' } */
  testimonials: []
};
