/* ============================================================================
   El dibujo de la familia
   ----------------------------------------------------------------------------
   Dos zonas: adentro del círculo viven juntos, afuera las personas cercanas
   importantes. Se toca un muñeco para agregarlo (queda acomodado solo) y se
   cambia de zona con dos botones grandes; arrastrar es opcional.
   ========================================================================== */

const Dibujo = (() => {

  const W = 660, H = 660, CX = 330, CY = 330;
  const RC = 196;   // círculo "viven en la misma casa"
  const RF = 305;   // borde exterior

  const MUNECOS = [
    { v:"mujer",  l:"Mujer"  },
    { v:"hombre", l:"Hombre" },
    { v:"nina",   l:"Niña"   },
    { v:"nino",   l:"Niño"   },
    { v:"perro",  l:"Perro",  mascota:true },
    { v:"gato",   l:"Gato",   mascota:true }
  ];

  const MASCOTAS = ["perro", "gato"];
  const esMascota = tipo => MASCOTAS.includes(tipo);

  const PARENTESCOS = ["Mamá","Papá","Esposo","Esposa","Pareja","Hijo","Hija","Hermano","Hermana",
    "Abuelo","Abuela","Nieto","Nieta","Tío","Tía","Primo","Prima","Sobrino","Sobrina",
    "Suegro","Suegra","Yerno","Nuera","Cuñado","Cuñada","Padrastro","Madrastra","Hijastro","Hijastra",
    "Amigo","Amiga","Vecino","Vecina","Otro familiar"];

  /* Para las mascotas se pregunta lo mismo, pero con ejemplos que tengan sentido */
  const VINCULOS_MASCOTA = ["Mascota","Perro de la casa","Gata de la casa","Compañía",
    "Como un hijo","Del niño","Llegó solo","Heredado de la familia"];

  const escala = t => {
    if(t === "nina" || t === "nino") return 0.92;
    if(esMascota(t)) return 0.95;
    return 1.25;
  };

  /* Muñeco en coordenadas locales, alto ≈ 48 */
  function glifo(tipo){
    /* Perro y gato van de perfil: de frente se confunden con un oso. */
    if(tipo === "perro")
      return `<path d="M-15 -1 q-5 -10 1 -13 q3.5 -1.5 3.5 2.5 q0 5 -1.5 9.5 z"/>
              <rect x="-16" y="-2" width="26" height="13" rx="6"/>
              <rect x="-13" y="9" width="5" height="9" rx="2.4"/>
              <rect x="3" y="9" width="5" height="9" rx="2.4"/>
              <circle cx="12" cy="-7" r="8"/>
              <rect x="14" y="-6.5" width="12" height="8" rx="3"/>
              <path d="M7.5 -14.5 q-4.5 1 -3.5 7 q1 5 5.5 3.5 z"/>
              <circle cx="12.5" cy="-9" r="1.7" fill="#fff"/>
              <circle cx="23.5" cy="-3" r="1.9" fill="#fff"/>`;
    if(tipo === "gato")
      return `<path d="M-14 1 q-9 -3 -7 -12 q1 -4.5 4.5 -3.5 q2.5 0.8 1.5 4.5 q-1.2 5 3 7.5 z"/>
              <rect x="-15" y="0" width="24" height="11" rx="5.5"/>
              <rect x="-12" y="9" width="4.6" height="9" rx="2.3"/>
              <rect x="3" y="9" width="4.6" height="9" rx="2.3"/>
              <circle cx="11" cy="-6" r="7.8"/>
              <path d="M5 -11 L3.5 -19.5 L11 -14 z"/>
              <path d="M13 -13.5 L18.5 -19 L18 -10.5 z"/>
              <circle cx="12.5" cy="-7" r="1.7" fill="#fff"/>
              <path d="M16.5 -3.2 h2.6 l-1.3 1.9 z" fill="#fff"/>`;
    if(tipo === "mujer" || tipo === "nina")
      return `<circle cx="0" cy="-16" r="7.2"/>
              <path d="M-13 10 L-6 -8 L6 -8 L13 10 Z"/>
              <rect x="-5" y="10" width="3.8" height="10" rx="1.6"/>
              <rect x="1.2" y="10" width="3.8" height="10" rx="1.6"/>`;
    return `<circle cx="0" cy="-16" r="7.2"/>
            <rect x="-11" y="-8" width="22" height="12.5" rx="5.5"/>
            <rect x="-8" y="3" width="6.6" height="16" rx="2.6"/>
            <rect x="1.4" y="3" width="6.6" height="16" rx="2.6"/>`;
  }

  const zonaDe = (x,y) => Math.hypot(x-CX, y-CY) <= RC ? "casa" : "fuera";

  /* Busca un lugar despejado dentro de la zona pedida. Se usa al agregar un
     muñeco de un toque y al cambiarlo de zona; si la persona lo arrastra, su
     posición se respeta y nunca se reacomoda sola. */
  function puntoLibre(personas, zona){
    const radios = zona === "casa" ? [112, 148, 74] : [(RC + RF)/2 + 6, RC + 42, RF - 34];
    const lejos = (x, y) => personas.every(p => Math.hypot(p.x - x, p.y - y) > 88);
    for(const r of radios){
      for(let i = 0; i < 12; i++){
        const a = -Math.PI/2 + (i / 12) * Math.PI * 2;
        const x = Math.round(CX + r * Math.cos(a));
        const y = Math.round(CY + r * Math.sin(a));
        if(lejos(x, y)) return {x, y};
      }
    }
    // Todo ocupado: se pone en el anillo principal aunque quede cerca de otro
    const a = -Math.PI/2 + personas.length * 2.399963;
    const r = radios[0];
    return { x: Math.round(CX + r * Math.cos(a)), y: Math.round(CY + r * Math.sin(a)) };
  }

  function svg(personas, seleccionado, paraImprimir){
    const esc = s => String(s == null ? "" : s)
      .replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

    let o = `<style>
      .zc{fill:#e5f1ec;stroke:#2f7d5f;stroke-width:2.5}
      .zf{fill:#fbf6ee;stroke:#e0cba6;stroke-width:2;stroke-dasharray:9 8}
      .zt{font:700 15px sans-serif;letter-spacing:.05em;text-anchor:middle}
      .yo{fill:#2f7d5f}
      .yot{fill:#fff;font:700 16px sans-serif;text-anchor:middle}
      .nm{font:600 16px sans-serif;text-anchor:middle;fill:#221e19}
      .pr{font:13.5px sans-serif;text-anchor:middle;fill:#6d6559}
      .sel{fill:none;stroke:#c07d1e;stroke-width:3.5;stroke-dasharray:6 4}
      .mn{cursor:pointer}
    </style>`;

    o += `<rect width="${W}" height="${H}" fill="${paraImprimir ? "#ffffff" : "none"}"/>`;
    o += `<circle cx="${CX}" cy="${CY}" r="${RF}" class="zf"/>`;
    o += `<circle cx="${CX}" cy="${CY}" r="${RC}" class="zc"/>`;
    o += `<text x="${CX}" y="${CY-RF+26}" class="zt" fill="#b08238">PERSONAS CERCANAS QUE NO VIVEN AQUÍ</text>`;
    o += `<text x="${CX}" y="${CY-RC+25}" class="zt" fill="#2f7d5f">VIVIMOS EN LA MISMA CASA</text>`;
    o += `<g><circle cx="${CX}" cy="${CY}" r="33" class="yo"/><text x="${CX}" y="${CY+6}" class="yot">YO</text></g>`;

    personas.forEach(p => {
      const color = p.zona === "casa" ? "#2f7d5f" : "#c07d1e";
      o += `<g class="mn" data-id="${p.id}">`;
      if(!paraImprimir) o += `<circle cx="${p.x}" cy="${p.y}" r="34" fill="transparent"/>`;
      if(seleccionado === p.id && !paraImprimir)
        o += `<circle cx="${p.x}" cy="${p.y}" r="36" class="sel"/>`;
      o += `<g transform="translate(${p.x},${p.y}) scale(${escala(p.tipo)})" fill="${color}">${glifo(p.tipo)}</g>`;
      o += `<text x="${p.x}" y="${p.y+50}" class="nm">${esc((p.nombre||"").slice(0,16))}</text>`;
      o += `<text x="${p.x}" y="${p.y+67}" class="pr">${esc((p.parentesco||"").slice(0,18))}</text>`;
      o += `</g>`;
    });
    return o;
  }

  /* Imagen PNG del dibujo, para descargar o adjuntar al informe */
  function png(personas, ancho){
    const k = (ancho || W*1.6) / W;
    const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W*k}" height="${H*k}" viewBox="0 0 ${W} ${H}">${svg(personas, null, true)}</svg>`;
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([doc], {type:"image/svg+xml;charset=utf-8"}));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = W*k; c.height = H*k;
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0,0,c.width,c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error("no se pudo generar la imagen")), "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("no se pudo dibujar")); };
      img.src = url;
    });
  }

  return { W, H, CX, CY, RC, RF, MUNECOS, MASCOTAS, esMascota, PARENTESCOS, VINCULOS_MASCOTA,
           glifo, escala, zonaDe, puntoLibre, svg, png };
})();
