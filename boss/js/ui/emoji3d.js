/* DANI OS — objetos 3D: renders propios (Blender Cycles) en assets/r3d.
   s/ = imagen fija · a/ = animación pequeña · b/ = animación grande para las piezas principales. */
(function (root) {
  const DOS = (root.DOS = root.DOS || {});
  const norm = (c) => String(c || '').replace(/️/g, '').trim();

  /* Emoji que usa la app (o que eligió el usuario en un hábito) → objeto real */
  const OBJECTS = {
    '💰': 'coin', '🪙': 'coin', '💵': 'coin', '💸': 'card', '💳': 'card', '🛒': 'card', '🤝': 'rings', '👥': 'rings', '📞': 'rings',
    '📅': 'calendar', '🗓': 'calendar', '✅': 'check', '🏋': 'dumbbell', '💪': 'dumbbell', '🏃': 'dumbbell', '🔥': 'trophy', '🏆': 'trophy',
    '💡': 'bulb', '🧠': 'bulb', '🔔': 'bulb', '⚡': 'bulb', '🚀': 'rocket', '✨': 'gem', '⭐': 'gem', '💎': 'gem', '🎯': 'gem', '🧘': 'gem', '🌱': 'gem',
    '⏰': 'sun', '🌅': 'sun', '☀': 'sun', '🌙': 'moon', '😴': 'moon', '🛌': 'moon', '🍽': 'cup', '☕': 'cup', '🥗': 'cup', '🍎': 'cup',
    '💻': 'laptop', '💼': 'laptop', '🎬': 'laptop', '📚': 'book', '📖': 'book', '🎓': 'book', '✍': 'book', '📝': 'book', '🧾': 'book', '💧': 'drop', '📈': 'bars',
  };

  /* Palabras del título → emoji. El primero que coincide gana. */
  const WORDS = [
    [/gim|entren|pesas|pierna|hombro|espalda|pecho|cardio|correr|trotar/, '🏋️'], [/yoga|medita|respira/, '🧘'],
    [/despert|levant|mañana/, '🌅'], [/dormir|descans|siesta/, '😴'], [/almuerz|comida|cena|desayun|comer|caf[eé]|pausa|break/, '☕'],
    [/llamada|tel[eé]fono|reuni|equipo|cliente|meet|zoom/, '🤝'], [/lee|lectura|libro|estudi|curso|clase|escrib|guion|nota/, '📖'],
    [/proyecto|lanza|landing|magna/, '🚀'], [/video|reel|grabar|contenido|edit|trabajo|profundo|oficina|correo/, '💻'],
    [/pago|factura|banco|contab|finanz|compra|super/, '💳'], [/agua/, '💧'],
  ];
  const BY_CATEGORY = { 'Reunión': '🤝', 'Trabajo': '💼', 'Gimnasio': '🏋️', 'Pago': '💳', 'Recordatorio': '🔔', 'Proyecto': '🚀', 'Personal': '✨' };
  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Objeto 3D. play=true lo deja girando; si no, se anima cuando el dashboard lo despierta. */
  DOS.e3d = (char, { size = 32, cls = '', eager = false, play = false } = {}) => {
    const name = OBJECTS[norm(char)] || 'gem';
    const big = size > 56 ? 'b' : 'a';
    const anim = `assets/r3d/${big}/${name}.webp`, fixed = `assets/r3d/s/${name}.webp`;
    const src = play && !still() ? anim : fixed;
    const wake = !play && size >= 24 ? ` data-a="${anim}"` : '';
    return `<img class="e3d ${cls}" src="${src}"${wake} width="${size}" height="${size}" alt="" decoding="async"${eager || play ? '' : ' loading="lazy"'}>`;
  };
  /** Emoji que mejor representa un bloque o evento. */
  DOS.e3dFor = (title, category) => {
    const t = String(title || '').toLowerCase();
    const hit = WORDS.find(([re]) => re.test(t));
    return hit ? hit[1] : BY_CATEGORY[category] || '🎯';
  };
  /** Hace girar un objeto una vuelta y lo devuelve a su imagen fija. */
  DOS.e3dWake = (img, ms = 5000) => {
    if (!img || !img.dataset.a || img.dataset.on || still()) return;
    const fixed = img.getAttribute('src');
    img.dataset.on = '1';
    img.src = img.dataset.a;
    setTimeout(() => { img.src = fixed; delete img.dataset.on; }, ms);
  };
})(typeof window !== 'undefined' ? window : globalThis);
