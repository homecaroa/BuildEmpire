/* ══════════ STARFIELD ══════════ */
(function(){
  const c=document.getElementById('stars-canvas'),ctx=c.getContext('2d');
  let W,H,stars=[];
  function resize(){W=c.width=innerWidth;H=c.height=innerHeight}
  function gen(){stars=[];for(let i=0;i<280;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3,p:Math.random()*Math.PI*2,sp:.0003+Math.random()*.0008})}
  function draw(t){ctx.clearRect(0,0,W,H);stars.forEach(s=>{const a=.25+.7*(.5+.5*Math.sin(t*s.sp*1000+s.p));ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(180,220,160,${a})`;ctx.fill()});requestAnimationFrame(draw)}
  window.addEventListener('resize',()=>{resize();gen()});resize();gen();requestAnimationFrame(draw);
})();

/* ══════════ PHYS TABLES ══════════ */
const PHYS={
  tamano:{enano:{radio:'3 400 km',gravedad:'0.38 g',label:'Enano'},pequeno:{radio:'7 600 km',gravedad:'0.64 g',label:'Pequeño'},terrestre:{radio:'6 371 km',gravedad:'1.00 g',label:'Terrestre'},supertierra:{radio:'11 500 km',gravedad:'1.50 g',label:'Supertierra'},mininetuno:{radio:'19 100 km',gravedad:'1.80 g',label:'Mini-Neptuno'}},
  estrella:{enana_roja:{lum:.04,col:'#ff6040',colName:'Roja M'},enana_naranja:{lum:.4,col:'#ffa040',colName:'Naranja K'},sol_like:{lum:1.0,col:'#ffe080',colName:'Amarilla G'},subgigante_f:{lum:3.0,col:'#fff8d0',colName:'Blanca F'}},
  distancia:{muy_cercano:{au:.5},cercano:{au:.75},medio:{au:1.0},lejano:{au:1.4},muy_lejano:{au:2.0}},
  atmosfera:{tenue:{atm:.1,label:'0.1 atm'},delgada:{atm:.5,label:'0.5 atm'},terrestre:{atm:1.0,label:'1.0 atm'},densa:{atm:3.0,label:'3.0 atm'},muy_densa:{atm:10,label:'10 atm'}},
  temperatura:{helado:{c:-80,label:'−80°C'},frio:{c:-20,label:'−20°C'},templado:{c:15,label:'15°C'},caliente:{c:60,label:'60°C'}},
};
function calcYear(d){return Math.round(365*Math.pow(PHYS.distancia[d.distancia].au,1.5)/Math.pow(PHYS.estrella[d.estrella].lum,.5))}
function calcHab(d){
  let s=50;
  if(d.temperatura==='templado')s+=20;else if(d.temperatura==='frio')s+=8;else if(d.temperatura==='caliente')s+=4;else s-=15;
  if(d.atmosfera==='terrestre')s+=20;else if(d.atmosfera==='delgada')s+=8;else if(d.atmosfera==='densa')s+=4;else if(d.atmosfera==='tenue')s-=12;else s-=20;
  const aw=parseInt(d.agua);if(aw>=30&&aw<=85)s+=15;else if(aw>0)s+=5;else s-=10;
  if(d.geologia==='moderada')s+=5;else if(d.geologia==='extrema')s-=15;else if(d.geologia==='inerte')s-=5;
  if(d.distancia==='medio')s+=10;else if(d.distancia==='cercano'||d.distancia==='lejano')s+=4;else s-=8;
  if(d.tamano==='mininetuno'||d.tamano==='enano')s-=10;
  if(d.magneticField==='none')s-=20;else if(d.magneticField==='weak')s-=8;else if(d.magneticField==='earth-like')s+=8;else if(d.magneticField==='strong')s+=12;
  if(d.stellarActivity==='extreme')s-=18;else if(d.stellarActivity==='active')s-=8;else if(d.stellarActivity==='quiet')s+=6;
  return Math.max(0,Math.min(100,s));
}
function calcSurface(d){
  const aw=parseInt(d.agua);let ice=0;
  if(d.temperatura==='helado')ice=Math.min(aw*.6+30,90);else if(d.temperatura==='frio')ice=Math.min(aw*.2+10,40);else if(d.temperatura==='caliente')ice=0;else ice=Math.min(aw*.05+2,15);
  return{land:Math.round(Math.max(0,100-Math.max(0,aw-ice)-ice)),water:Math.round(Math.max(0,aw-ice)),ice:Math.round(ice)};
}

/* ══════════ PLANET RENDERER — MAX REALISM ══════════ */
let pAngle=0,pFrame=null;

// Deterministic PRNG
function mkRNG(seed){let s=((seed>>>0)%2147483647)||1;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}

// Smooth noise 2D — sin-based fBm for organic shapes
function smoothNoise(x,y,seed){
  const s=seed*127.1;
  return(Math.sin(x*127.1+s)*43758.5453+Math.sin(y*311.7+s)*43758.5453)%1;
}
function fbm(x,y,seed,oct){
  let v=0,a=0.5,f=1;
  for(let i=0;i<oct;i++){v+=a*((Math.sin((x*f*2.1+seed)*1.7)*Math.cos((y*f*1.9+seed)*2.3)+1)*0.5);a*=0.5;f*=2.1;}
  return v;
}

function drawPlanet(d){
  const cv=document.getElementById('planet-canvas');if(!cv)return;
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx=W/2,cy=H/2,R=W*0.43;
  ctx.clearRect(0,0,W,H);

  const aw=parseInt(d.agua);
  const surf=calcSurface(d);
  const star=PHYS.estrella[d.estrella];
  const tempC=PHYS.temperatura[d.temperatura].c;
  const atm=PHYS.atmosfera[d.atmosfera].atm;
  const lum=star.lum;

  // ── Derive colour parameters from physics ─────────────────
  // Ocean colour: deep/shallow vary by temperature
  const oceanR= tempC<-20 ? [8,20,55]  : tempC>30 ? [5,30,70]  : [10,30,80];
  const oceanS= tempC<-20 ? [20,50,120]: tempC>30 ? [15,70,140]: [25,80,160];

  // Land palette: 3 colours for variety
  const landPal={
    rocoso: [[74,60,46],[100,84,64],[52,42,32]],
    arenoso:[[192,144,72],[220,176,96],[160,112,48]],
    volcanico:[[32,24,32],[48,28,36],[20,14,18]],
    selvatico:[[30,64,24],[42,88,32],[20,48,16]],
    helado:  [[138,176,192],[168,200,216],[104,144,168]],
    salino:  [[200,192,160],[224,216,184],[176,168,136]],
  }[d.suelo]||[[74,60,46],[100,84,64],[52,42,32]];

  // Atmosphere colour tint
  let atmR,atmG,atmB;
  if(d.atmosfera==='muy_densa'){atmR=220;atmG=140;atmB=60}
  else if(tempC>30){atmR=160;atmG=140;atmB=80}
  else if(tempC<-30){atmR=140;atmG=180;atmB=220}
  else{atmR=80;atmG=140;atmB=220}

  const cloudCover={arido:0.05,estacional:0.35,frecuente:0.65,tormentas:0.92}[d.precipitaciones]||0.3;
  const seed=(d.suelo.charCodeAt(0)*31+d.temperatura.charCodeAt(0)*17+aw*7)&0xffff;

  // ── 1. DEEP SPACE GLOW (limb darkening around planet) ─────
  const spaceGrd=ctx.createRadialGradient(cx,cy,R*0.9,cx,cy,R*1.35);
  spaceGrd.addColorStop(0,`rgba(${atmR},${atmG},${atmB},${Math.min(atm*0.04,0.5)})`);
  spaceGrd.addColorStop(0.4,`rgba(${atmR},${atmG},${atmB},${Math.min(atm*0.015,0.2)})`);
  spaceGrd.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(cx,cy,R*1.35,0,Math.PI*2);
  ctx.fillStyle=spaceGrd;ctx.fill();

  // ── 2. CLIP to sphere ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();

  // ── 3. OCEAN BASE with rayleigh-like scattering ────────────
  if(aw>0){
    // Deep ocean gradient (centre → limb gets darker)
    const og=ctx.createRadialGradient(cx-R*0.2,cy-R*0.2,0,cx,cy,R*1.05);
    og.addColorStop(0,`rgb(${oceanS[0]},${oceanS[1]},${oceanS[2]})`);
    og.addColorStop(0.4,`rgb(${Math.round(oceanS[0]*0.7)},${Math.round(oceanS[1]*0.7)},${Math.round(oceanS[2]*0.8)})`);
    og.addColorStop(0.8,`rgb(${oceanR[0]},${oceanR[1]},${oceanR[2]})`);
    og.addColorStop(1,`rgb(${Math.round(oceanR[0]*0.4)},${Math.round(oceanR[1]*0.4)},${Math.round(oceanR[2]*0.5)})`);
    ctx.fillStyle=og;ctx.fillRect(0,0,W,H);

    // Subtle ocean surface shimmer lines
    const rngO=mkRNG(seed+5);
    ctx.globalAlpha=0.04;
    for(let i=0;i<12;i++){
      const oy=cy-R+(rngO()*R*2),ox1=cx-R*rngO(),ox2=cx+R*rngO();
      ctx.beginPath();ctx.moveTo(ox1,oy);ctx.lineTo(ox2,oy+rngO()*8-4);
      ctx.strokeStyle='rgba(200,240,255,1)';ctx.lineWidth=1+rngO();ctx.stroke();
    }
    ctx.globalAlpha=1;
  } else {
    // Dry planet base
    const dg=ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,0,cx,cy,R);
    dg.addColorStop(0,`rgb(${landPal[0][0]+40},${landPal[0][1]+30},${landPal[0][2]+20})`);
    dg.addColorStop(0.6,`rgb(${landPal[0][0]},${landPal[0][1]},${landPal[0][2]})`);
    dg.addColorStop(1,`rgb(${Math.round(landPal[0][0]*0.5)},${Math.round(landPal[0][1]*0.5)},${Math.round(landPal[0][2]*0.5)})`);
    ctx.fillStyle=dg;ctx.fillRect(0,0,W,H);
  }

  // ── 4. CONTINENTS with noise-based shapes ─────────────────
  if(surf.land>3){
    const rng=mkRNG(seed);
    const nConts=Math.max(1,Math.round(surf.land/15));

    // Generate continent positions on sphere
    for(let ci=0;ci<nConts+3;ci++){
      const ang=rng()*Math.PI*2;
      const dist=rng()*R*0.7;
      const bx=cx+Math.cos(ang+pAngle*0.0006)*dist;
      const by=cy+Math.sin(ang+pAngle*0.0005)*dist;
      const bw=R*(0.12+rng()*0.38*(surf.land/100+0.25));
      const bh=bw*(0.45+rng()*0.65);
      const rot=rng()*Math.PI;
      const lc=landPal[ci%3];

      ctx.save();
      ctx.translate(bx,by);ctx.rotate(rot);

      // Main continent shape using fBm-deformed ellipse
      ctx.beginPath();
      const pts=18;
      for(let p=0;p<pts;p++){
        const a=(p/pts)*Math.PI*2;
        const nx=Math.cos(a),ny=Math.sin(a);
        const noiseVal=fbm(nx*0.8+ci*0.3,ny*0.8+ci*0.2,seed+ci,4);
        const r=bw*(0.55+noiseVal*0.45);
        const rx=Math.cos(a)*r, ry=Math.sin(a)*(bh/bw)*r;
        p===0?ctx.moveTo(rx,ry):ctx.lineTo(rx,ry);
      }
      ctx.closePath();

      // Land gradient: darker near edges (mountain shadow effect)
      const lg=ctx.createRadialGradient(bw*0.2,-bh*0.1,0,0,0,bw);
      lg.addColorStop(0,`rgb(${Math.min(lc[0]+40,255)},${Math.min(lc[1]+35,255)},${Math.min(lc[2]+25,255)})`);
      lg.addColorStop(0.5,`rgb(${lc[0]},${lc[1]},${lc[2]})`);
      lg.addColorStop(1,`rgb(${Math.round(lc[0]*0.6)},${Math.round(lc[1]*0.6)},${Math.round(lc[2]*0.6)})`);
      ctx.fillStyle=lg;ctx.fill();

      // Coastal highlight (lighter strip at coast)
      if(aw>0){
        ctx.strokeStyle=`rgba(${Math.min(lc[0]+60,255)},${Math.min(lc[1]+60,255)},${Math.min(lc[2]+40,255)},0.35)`;
        ctx.lineWidth=3+rng()*4;ctx.stroke();
      }

      // Vegetation tint on jungle worlds
      if(d.suelo==='selvatico'&&aw>20){
        ctx.beginPath();
        for(let p=0;p<pts;p++){const a=(p/pts)*Math.PI*2;const r=bw*(0.3+fbm(Math.cos(a)*0.6+ci,Math.sin(a)*0.6,seed+99,3)*0.25);p===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*(bh/bw)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*(bh/bw)*r)}
        ctx.closePath();
        ctx.fillStyle=`rgba(20,80,10,0.55)`;ctx.fill();
      }

      // Volcanic lava channels
      if(d.suelo==='volcanico'||d.geologia==='extrema'){
        for(let v=0;v<4;v++){
          const vx=(rng()-0.5)*bw*0.9,vy=(rng()-0.5)*bh*0.9;
          const vr=6+rng()*14;
          const vg=ctx.createRadialGradient(vx,vy,0,vx,vy,vr);
          vg.addColorStop(0,'rgba(255,140,10,0.95)');
          vg.addColorStop(0.4,'rgba(200,50,0,0.6)');
          vg.addColorStop(1,'rgba(80,0,0,0)');
          ctx.beginPath();ctx.arc(vx,vy,vr,0,Math.PI*2);
          ctx.fillStyle=vg;ctx.fill();
        }
        // Lava flow lines
        for(let f=0;f<3;f++){
          const fx=(rng()-0.5)*bw*0.7,fy=(rng()-0.5)*bh*0.7;
          ctx.beginPath();ctx.moveTo(fx,fy);
          ctx.quadraticCurveTo(fx+rng()*30-15,fy+rng()*30-15,fx+rng()*50-25,fy+rng()*60);
          ctx.strokeStyle=`rgba(255,${80+Math.round(rng()*60)},0,${0.4+rng()*0.4})`;
          ctx.lineWidth=2+rng()*3;ctx.stroke();
        }
      }

      // Desert sand dunes
      if(d.suelo==='arenoso'){
        for(let du=0;du<5;du++){
          const dx=(rng()-0.5)*bw,dy=(rng()-0.5)*bh*0.8;
          ctx.beginPath();
          ctx.ellipse(dx,dy,bw*0.15,bh*0.04,rng()*0.5,0,Math.PI*2);
          ctx.fillStyle=`rgba(220,190,100,0.3)`;ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  // ── 5. POLAR ICE CAPS with fractal edge ──────────────────
  if(surf.ice>1){
    const iceAmt=surf.ice/100;
    const capRad=R*(0.08+iceAmt*0.55);
    const rngI=mkRNG(seed+200);

    // North pole
    ctx.save();ctx.translate(cx,cy-R*0.58);
    ctx.beginPath();
    const ipts=24;
    for(let p=0;p<ipts;p++){
      const a=(p/ipts)*Math.PI*2;
      const nr=capRad*(0.75+fbm(Math.cos(a)*1.5,Math.sin(a)*1.5,seed+77,3)*0.5);
      p===0?ctx.moveTo(Math.cos(a)*nr,Math.sin(a)*nr*0.5):ctx.lineTo(Math.cos(a)*nr,Math.sin(a)*nr*0.5);
    }
    ctx.closePath();
    const iceG=ctx.createRadialGradient(0,-capRad*0.3,0,0,0,capRad);
    iceG.addColorStop(0,'rgba(248,252,255,0.98)');
    iceG.addColorStop(0.5,'rgba(210,235,252,0.85)');
    iceG.addColorStop(1,'rgba(180,215,245,0.4)');
    ctx.fillStyle=iceG;ctx.fill();
    ctx.restore();

    // South pole
    ctx.save();ctx.translate(cx,cy+R*0.58);
    ctx.beginPath();
    for(let p=0;p<ipts;p++){
      const a=(p/ipts)*Math.PI*2;
      const nr=capRad*(0.65+fbm(Math.cos(a)*1.5+1,Math.sin(a)*1.5+1,seed+88,3)*0.45);
      p===0?ctx.moveTo(Math.cos(a)*nr,Math.sin(a)*nr*0.5):ctx.lineTo(Math.cos(a)*nr,Math.sin(a)*nr*0.5);
    }
    ctx.closePath();
    const iceG2=ctx.createRadialGradient(0,capRad*0.2,0,0,0,capRad*0.9);
    iceG2.addColorStop(0,'rgba(245,250,255,0.95)');
    iceG2.addColorStop(1,'rgba(180,215,245,0.35)');
    ctx.fillStyle=iceG2;ctx.fill();
    ctx.restore();
  }

  // ── 6. CLOUD SYSTEM ──────────────────────────────────────
  if(cloudCover>0.04){
    const rngC=mkRNG(seed+50+Math.floor(pAngle*0.01));
    const nClouds=Math.round(5+cloudCover*20);

    for(let ci=0;ci<nClouds;ci++){
      // Clouds drift slowly east (simulate rotation)
      const baseAng=pAngle*0.0018+ci*0.34;
      const latBias=(rngC()-0.5)*0.8; // latitude bias
      const cdist=R*(0.05+rngC()*0.82);
      const cx2=cx+Math.cos(baseAng)*cdist;
      const cy2=cy+Math.sin(baseAng)*cdist+latBias*R;

      // Cloud puff: multiple overlapping soft circles
      const puffs=2+Math.floor(rngC()*4);
      for(let pf=0;pf<puffs;pf++){
        const px=cx2+(rngC()-0.5)*R*0.12,py=cy2+(rngC()-0.5)*R*0.06;
        const pr=R*(0.04+rngC()*0.1);
        const alpha=cloudCover*(0.35+rngC()*0.35);
        const cg=ctx.createRadialGradient(px,py,0,px,py,pr);
        cg.addColorStop(0,`rgba(252,254,255,${alpha})`);
        cg.addColorStop(0.5,`rgba(240,248,255,${alpha*0.6})`);
        cg.addColorStop(1,'rgba(230,244,255,0)');
        ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);
        ctx.fillStyle=cg;ctx.fill();
      }
    }

    // Tropical storm / hurricane for tormentas
    if(d.precipitaciones==='tormentas'){
      const stx=cx+R*0.2,sty=cy-R*0.1;
      // Spiral bands
      for(let band=0;band<3;band++){
        const br=R*(0.08+band*0.08);
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.1){
          const spiral=br*(1-a/(Math.PI*4));
          const sx=stx+Math.cos(a+pAngle*0.002)*spiral;
          const sy=sty+Math.sin(a+pAngle*0.002)*spiral*0.7;
          a===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
        }
        ctx.strokeStyle=`rgba(200,220,255,${0.5-band*0.12})`;
        ctx.lineWidth=3-band*0.8;ctx.stroke();
      }
      // Eye
      const eg=ctx.createRadialGradient(stx,sty,0,stx,sty,R*0.04);
      eg.addColorStop(0,'rgba(160,180,200,0.6)');
      eg.addColorStop(1,'rgba(160,180,200,0)');
      ctx.beginPath();ctx.arc(stx,sty,R*0.04,0,Math.PI*2);
      ctx.fillStyle=eg;ctx.fill();

      // Lightning flash
      if(pAngle%60<4){
        ctx.beginPath();
        ctx.moveTo(stx+R*0.08,sty-R*0.1);
        ctx.lineTo(stx+R*0.03,sty);
        ctx.lineTo(stx+R*0.09,sty+0.02);
        ctx.lineTo(stx+R*0.02,sty+R*0.12);
        ctx.strokeStyle='rgba(255,250,180,0.95)';ctx.lineWidth=2;ctx.stroke();
        // Glow
        ctx.shadowColor='rgba(255,255,150,0.8)';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
      }
    }
  }

  // ── 7. AURORA (if strong magnetic field + active star) ────
  if((d.magneticField==='strong'||d.magneticField==='earth-like')&&
     (d.stellarActivity==='active'||d.stellarActivity==='extreme')){
    const auroraColors=['rgba(50,255,120,', 'rgba(80,180,255,', 'rgba(180,80,255,'];
    [-1,1].forEach(pole=>{
      const ay=cy+pole*R*0.72;
      for(let ab=0;ab<6;ab++){
        const ax=cx+(ab-3)*R*0.18;
        const aHeight=R*(0.06+Math.sin(pAngle*0.04+ab)*0.04);
        const ac=auroraColors[ab%3];
        const ag=ctx.createRadialGradient(ax,ay,0,ax,ay,aHeight*2);
        ag.addColorStop(0,ac+`${0.15+Math.sin(pAngle*0.03+ab)*0.08})`);
        ag.addColorStop(1,ac+'0)');
        ctx.beginPath();ctx.ellipse(ax,ay,R*0.08,aHeight,0,0,Math.PI*2);
        ctx.fillStyle=ag;ctx.fill();
      }
    });
  }

  // ── 8. TERMINATOR (day/night shadow) ─────────────────────
  // Soft terminator: ~45° from star (top-left)
  const termG=ctx.createLinearGradient(cx-R*0.1,cy-R,cx+R*0.85,cy+R);
  termG.addColorStop(0,'rgba(0,0,0,0)');
  termG.addColorStop(0.55,'rgba(0,0,10,0.05)');
  termG.addColorStop(0.72,'rgba(0,0,15,0.35)');
  termG.addColorStop(0.88,'rgba(0,0,20,0.62)');
  termG.addColorStop(1,'rgba(0,0,25,0.80)');
  ctx.fillStyle=termG;ctx.fillRect(0,0,W,H);

  // Subtle night-side city lights (industrialized worlds)
  if(d.geologia!=='inerte'&&d.temperatura!=='helado'){
    const nlRNG=mkRNG(seed+999);
    ctx.globalAlpha=0.0;// Will increase in terminator zone via blend
    for(let nl=0;nl<20;nl++){
      const nx=cx+R*(0.5+nlRNG()*0.45),ny=cy+(nlRNG()-0.5)*R*1.6;
      if(nx*nx+ny*ny>R*R)continue;
      ctx.globalAlpha=nlRNG()*0.18;
      ctx.beginPath();ctx.arc(nx,ny,1.2+nlRNG()*2,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,240,${150+Math.round(nlRNG()*80)},1)`;
      ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // ── 9. SPECULAR HIGHLIGHT (star reflection) ──────────────
  const specG=ctx.createRadialGradient(cx-R*0.32,cy-R*0.32,0,cx-R*0.25,cy-R*0.25,R*0.7);
  specG.addColorStop(0,`rgba(255,255,255,${aw>30?0.12:0.07})`);
  specG.addColorStop(0.3,'rgba(255,255,255,0.03)');
  specG.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=specG;ctx.fillRect(0,0,W,H);

  // Ocean specular (glint)
  if(aw>20){
    const glintG=ctx.createRadialGradient(cx-R*0.28,cy-R*0.28,0,cx-R*0.28,cy-R*0.28,R*0.18);
    glintG.addColorStop(0,'rgba(255,255,255,0.22)');
    glintG.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath();ctx.arc(cx-R*0.28,cy-R*0.28,R*0.18,0,Math.PI*2);
    ctx.fillStyle=glintG;ctx.fill();
  }

  ctx.restore(); // end clip

  // ── 10. ATMOSPHERE LIMB GLOW (outside sphere) ─────────────
  if(atm>0.05){
    const limbThick=R*(0.02+atm*0.04);
    const limbAlpha=Math.min(atm*0.25,0.7);
    const limbG=ctx.createRadialGradient(cx,cy,R-2,cx,cy,R+limbThick*3);
    limbG.addColorStop(0,`rgba(${atmR},${atmG},${atmB},${limbAlpha})`);
    limbG.addColorStop(0.4,`rgba(${atmR},${atmG},${atmB},${limbAlpha*0.4})`);
    limbG.addColorStop(1,`rgba(${atmR},${atmG},${atmB},0)`);
    ctx.beginPath();ctx.arc(cx,cy,R+limbThick*3,0,Math.PI*2);
    ctx.fillStyle=limbG;ctx.fill();

    // Thin bright limb line
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle=`rgba(${Math.min(atmR+80,255)},${Math.min(atmG+80,255)},${Math.min(atmB+80,255)},${Math.min(atm*0.15,0.4)})`;
    ctx.lineWidth=atm>3?5:2;ctx.stroke();
  }

  // ── 11. STAR MINIATURE (top-left corner) ─────────────────
  const sr=7+Math.min(lum*4,16);
  // Corona glow
  const coroG=ctx.createRadialGradient(26,26,0,26,26,sr*3.5);
  coroG.addColorStop(0,star.col);
  coroG.addColorStop(0.2,hexA(star.col,0.7));
  coroG.addColorStop(0.6,hexA(star.col,0.15));
  coroG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(26,26,sr*3.5,0,Math.PI*2);
  ctx.fillStyle=coroG;ctx.fill();
  // Star disc
  ctx.beginPath();ctx.arc(26,26,sr,0,Math.PI*2);
  ctx.fillStyle=star.col;ctx.fill();
  // Bright centre
  const starCG=ctx.createRadialGradient(26-sr*0.25,26-sr*0.25,0,26,26,sr);
  starCG.addColorStop(0,'rgba(255,255,255,0.8)');
  starCG.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(26,26,sr,0,Math.PI*2);
  ctx.fillStyle=starCG;ctx.fill();

  // ── 12. HISTORY LAYERS (war smoke, city lights, orbital, colony, plague) ──
  drawPlanetHistoryLayers(ctx,cx,cy,R);
}

function startPlanetLoop(){
  if(pFrame)cancelAnimationFrame(pFrame);
  function loop(){pAngle++;drawPlanet(readData());drawHexMap();pFrame=requestAnimationFrame(loop)}
  loop();
}

/* ══════════ SELECT INFO DATABASE ══════════
   Para cada select y cada valor: título, descripción científica, efectos en juego
══════════════════════════════════════════ */
const SELECT_INFO={
  tamano:{
    enano:{title:'Planeta Enano',desc:'Radio ~3400 km, similar a Marte. Gravedad de solo 0.38 g. La baja masa hace difícil retener atmósferas densas, pero permite escapar al espacio con mucho menos energía.',effects:[{label:'Baja gravedad',cls:'si-pos'},{label:'Pierde atmósfera',cls:'si-neg'},{label:'Escape espacial fácil',cls:'si-pos'}]},
    pequeno:{title:'Planeta Pequeño',desc:'Radio ~7600 km, 0.6 g de gravedad. Más masivo que Marte pero menos que la Tierra. Puede retener atmósferas moderadas. Recursos minerales más concentrados en superficie.',effects:[{label:'Gravedad moderada',cls:'si-neu'},{label:'Atmósfera limitada',cls:'si-neg'}]},
    terrestre:{title:'Planeta Terrestre',desc:'Radio 6371 km, exactamente 1 g. La combinación óptima de masa, gravedad y tamaño para retener una atmósfera estable con N₂/O₂ y mantener agua líquida en superficie.',effects:[{label:'Gravedad óptima',cls:'si-pos'},{label:'Retiene atmósfera',cls:'si-pos'},{label:'Agua líquida posible',cls:'si-pos'}]},
    supertierra:{title:'Supertierra',desc:'Radio ~11500 km, 1.5 g. La alta gravedad dificulta el vuelo y la vida de organismos grandes, pero el campo magnético es muy potente y protege bien la atmósfera de los vientos estelares.',effects:[{label:'Alta gravedad',cls:'si-neg'},{label:'Campo magnético fuerte',cls:'si-pos'},{label:'Atmósfera muy estable',cls:'si-pos'}]},
    mininetuno:{title:'Mini-Neptuno',desc:'Radio ~19100 km, 1.8 g. Esta categoría no tiene superficie rocosa accesible. Su envoltura gaseosa de H₂/He es inevitablemente densa (≥10 atm). Habitabilidad convencional casi nula.',effects:[{label:'Sin superficie rocosa',cls:'si-neg'},{label:'Atmósfera H₂/He',cls:'si-neg'},{label:'Muy inhóspito',cls:'si-neg'}]},
  },
  estrella:{
    enana_roja:{title:'Enana Roja tipo M',desc:'La estrella más común del universo. Luminosidad solo 4% del Sol. Su zona habitable está muy próxima (~0.1–0.4 UA), lo que genera mareas gravitacionales y posible rotación sincrónica. Vida útil >100 000 millones de años.',effects:[{label:'ZH muy cercana',cls:'si-neg'},{label:'Mareas gravitacionales',cls:'si-neg'},{label:'Vida larguísima',cls:'si-pos'},{label:'Erupciones frecuentes',cls:'si-neg'}]},
    enana_naranja:{title:'Enana Naranja tipo K',desc:'Considerada la "zona de confort" para la vida. 40% de la luminosidad solar, más estable que las enanas rojas y con vida útil de 25–50 Ga. Zona habitable bien posicionada sin mareas gravitacionales problemáticas.',effects:[{label:'Alta estabilidad',cls:'si-pos'},{label:'ZH bien posicionada',cls:'si-pos'},{label:'Vida muy larga',cls:'si-pos'}]},
    sol_like:{title:'Enana Amarilla tipo G',desc:'Nuestra propia estrella es el referente. Luminosidad 1 L☉, zona habitable entre 0.95 y 1.67 UA. Vida útil ~10 Ga. Referencia conocida para la habitabilidad planetaria.',effects:[{label:'Referencia solar',cls:'si-pos'},{label:'ZH amplia',cls:'si-pos'},{label:'Vida media 10 Ga',cls:'si-neu'}]},
    subgigante_f:{title:'Subgigante tipo F',desc:'Estrella 3 veces más luminosa que el Sol, más caliente y azul-blanca. Su zona habitable está más lejos pero la mayor irradiación UV puede dañar el ADN. Vida útil corta (~3 Ga), lo que limita la evolución compleja.',effects:[{label:'Alta luminosidad UV',cls:'si-neg'},{label:'ZH exterior',cls:'si-neu'},{label:'Vida útil corta',cls:'si-neg'},{label:'Años orbitales largos',cls:'si-neu'}]},
  },
  distancia:{
    muy_cercano:{title:'Borde interior de la ZH',desc:'Equivalente a ~0.5 UA de una estrella solar. La irradiación es muy alta. El agua tiende a evaporarse y retroalimentar el efecto invernadero (Runaway Greenhouse). Parecido a Venus antes de su transformación.',effects:[{label:'Irradiación muy alta',cls:'si-neg'},{label:'Riesgo invernadero',cls:'si-neg'},{label:'Año orbital muy corto',cls:'si-neu'}]},
    cercano:{title:'Zona Habitable interior',desc:'~0.75 UA equivalente. Temperatura media alta pero habitable con atmósfera correcta. Años orbitales cortos. Mayor actividad climática y erosión superficial.',effects:[{label:'Temperatura elevada',cls:'si-neg'},{label:'Año corto',cls:'si-neu'},{label:'Habitable con atmósfera',cls:'si-pos'}]},
    medio:{title:'Centro de la Zona Habitable',desc:'La posición óptima. Equivalente a 1 UA solar. Irradiación equilibrada, temperatura superficial propicia para agua líquida, año orbital de referencia. Máxima puntuación de habitabilidad.',effects:[{label:'Temperatura óptima',cls:'si-pos'},{label:'Agua líquida estable',cls:'si-pos'},{label:'Habitabilidad máxima',cls:'si-pos'}]},
    lejano:{title:'Zona Habitable exterior',desc:'~1.4 UA equivalente. Temperaturas más frías, ciclos estacionales amplios. El agua puede existir pero con periodos de congelación estacional. Años orbitales largos.',effects:[{label:'Temperatura baja',cls:'si-neg'},{label:'Congelación estacional',cls:'si-neg'},{label:'Año orbital largo',cls:'si-neu'}]},
    muy_lejano:{title:'Borde exterior de la ZH',desc:'~2 UA equivalente. Solo posible con efecto invernadero notable. Sin atmósfera densa el planeta queda helado. Las enanas rojas no alcanzan aquí su ZH real.',effects:[{label:'Frío extremo sin invernadero',cls:'si-neg'},{label:'Requiere atmósfera densa',cls:'si-neg'},{label:'Año orbital muy largo',cls:'si-neg'}]},
  },
  temperatura:{
    helado:{title:'Mundo Helado (< −50°C)',desc:'La mayor parte del agua está congelada en gruesas capas de hielo. Los océanos líquidos solo existen bajo el hielo (como Europa). La vida posible es extremófila. Los glaciares modelan completamente el relieve.',effects:[{label:'Agua en estado sólido',cls:'si-neg'},{label:'Habitabilidad baja',cls:'si-neg'},{label:'Posible vida subglacial',cls:'si-neu'}]},
    frio:{title:'Mundo Frío (−50°C a 0°C)',desc:'Temperaturas bajo cero en promedio pero con variaciones estacionales. Tundras, taiga y mares árticos. La vida es posible pero con adaptaciones al frío. El metabolismo se ralentiza.',effects:[{label:'Agua parcialmente líquida',cls:'si-neu'},{label:'Vida con adaptaciones',cls:'si-neu'},{label:'Ciclos estacionales extremos',cls:'si-neg'}]},
    templado:{title:'Mundo Templado (0°C a 30°C)',desc:'La banda de temperatura ideal para la vida compleja tal como la conocemos. El agua líquida es abundante y estable. Los ecosistemas más ricos del universo conocido se desarrollan en estas condiciones.',effects:[{label:'Agua líquida estable',cls:'si-pos'},{label:'Ecosistemas ricos',cls:'si-pos'},{label:'Habitabilidad máxima',cls:'si-pos'}]},
    caliente:{title:'Mundo Caliente (30°C a 80°C)',desc:'Temperaturas elevadas que aceleran la evaporación. El efecto invernadero puede descontrolarse si hay mucha agua. Posibles formas de vida termofílicas. La vegetación es escasa salvo en zonas polares.',effects:[{label:'Evaporación intensa',cls:'si-neg'},{label:'Riesgo invernadero',cls:'si-neg'},{label:'Vida termofílica posible',cls:'si-neu'}]},
  },
  atmosfera:{
    tenue:{title:'Atmósfera Tenue (0.1 atm)',desc:'Presión equivalente a 10 km de altitud en la Tierra. Sin ciclo hidrológico activo, sin tormentas ni lluvia. La radiación cósmica llega directamente a la superficie. Solo organismos con protección especial pueden sobrevivir.',effects:[{label:'Sin ciclo del agua',cls:'si-neg'},{label:'Radiación directa',cls:'si-neg'},{label:'Sin efecto invernadero',cls:'si-neg'}]},
    delgada:{title:'Atmósfera Delgada (0.5 atm)',desc:'Como vivir a 4000 m de altitud. Presión suficiente para lluvia y ciclo hidrológico básico. La vida se adapta con pulmones más eficientes. Protección parcial contra radiación.',effects:[{label:'Lluvia posible',cls:'si-pos'},{label:'Protección parcial UV',cls:'si-neu'},{label:'Adaptación pulmonar',cls:'si-neg'}]},
    terrestre:{title:'Atmósfera Terrestre (1.0 atm)',desc:'La presión de referencia, con la mezcla N₂/O₂ óptima para la respiración aeróbica. Efecto invernadero moderado que mantiene la temperatura estable. Ciclo del agua completo.',effects:[{label:'Respiración directa posible',cls:'si-pos'},{label:'Ciclo del agua completo',cls:'si-pos'},{label:'Temperatura estable',cls:'si-pos'}]},
    densa:{title:'Atmósfera Densa (3.0 atm)',desc:'Equivalente a 20 metros bajo el agua. Efecto invernadero notable, temperatura media más alta de lo esperado. La vida puede adaptarse pero con organismo corporalmente más robusto. Tormentas más violentas.',effects:[{label:'Invernadero notable',cls:'si-neg'},{label:'Tormentas violentas',cls:'si-neg'},{label:'Temperatura más alta',cls:'si-neg'},{label:'Organismos robustos',cls:'si-neu'}]},
    muy_densa:{title:'Atmósfera Muy Densa (10 atm)',desc:'Tipo Venus. La presión aplasta. La temperatura superficial puede superar 400°C si hay CO₂. Solo posible en planetas muy masivos o con composición química especial. Inhabitable para vida convencional.',effects:[{label:'Aplastante',cls:'si-neg'},{label:'Temperatura extrema',cls:'si-neg'},{label:'Tipo Venus',cls:'si-neg'}]},
  },
  geologia:{
    inerte:{title:'Geología Inerte',desc:'Sin tectónica de placas activa. La superficie no se renueva. Los minerales esenciales para la vida (fósforo, hierro) no circulan. La atmósfera no recibe gases volcánicos renovadores. Mundo estático y empobrecido a largo plazo.',effects:[{label:'Sin renovación mineral',cls:'si-neg'},{label:'Atmósfera no renovada',cls:'si-neg'},{label:'Relieve erosionado plano',cls:'si-neu'}]},
    baja:{title:'Baja Actividad Geológica',desc:'Actividad volcánica residual. Algún volcán activo ocasional que aporta minerales y CO₂. Las placas se mueven lentamente. Montañas antiguas y erosionadas. Estabilidad climática pero poca renovación.',effects:[{label:'Pocos recursos minerales',cls:'si-neg'},{label:'Clima estable',cls:'si-pos'},{label:'Montañas bajas',cls:'si-neu'}]},
    moderada:{title:'Actividad Geológica Moderada',desc:'Como la Tierra actual. El ciclo tectónico renueva la corteza, recicla el carbono y crea montañas. Los volcanes fertilizan el suelo con minerales. El campo magnético se mantiene activo.',effects:[{label:'Ciclo del carbono activo',cls:'si-pos'},{label:'Suelo fértil',cls:'si-pos'},{label:'Campo magnético activo',cls:'si-pos'}]},
    alta:{title:'Alta Actividad Geológica',desc:'Volcanes muy activos en múltiples regiones. El CO₂ volcánico puede saturar la atmósfera. Los terremotos son frecuentes. La superficie cambia rápidamente. Dificulta los asentamientos pero enriquece el suelo con minerales raros.',effects:[{label:'CO₂ volcánico excesivo',cls:'si-neg'},{label:'Suelo muy rico',cls:'si-pos'},{label:'Terremotos frecuentes',cls:'si-neg'},{label:'Minerales raros',cls:'si-pos'}]},
    extrema:{title:'Geología Extrema (Io-like)',desc:'Como la luna Io de Júpiter: volcanes activos en toda la superficie, ríos de lava y erupciones masivas continuas. La desgasificación volcánica acidifica océanos. Prácticamente inhabitable pero con recursos minerales extraordinarios.',effects:[{label:'Lava omnipresente',cls:'si-neg'},{label:'Océanos ácidos',cls:'si-neg'},{label:'Minerales extraordinarios',cls:'si-pos'},{label:'Habitabilidad mínima',cls:'si-neg'}]},
  },
  stellarActivity:{
    quiet:{title:'Actividad Estelar Tranquila',desc:'La estrella emite radiación de forma muy estable, sin erupciones ni tormentas solares significativas. La atmósfera no sufre bombardeos de partículas. Condiciones favorables para el desarrollo de ADN complejo sin mutaciones aceleradas.',effects:[{label:'ADN estable',cls:'si-pos'},{label:'Atmósfera preservada',cls:'si-pos'},{label:'Baja mutación genética',cls:'si-pos'}]},
    moderate:{title:'Actividad Estelar Moderada',desc:'Erupciones solares ocasionales, como el Sol actual. El campo magnético planetario gestiona bien la mayoría de las tormentas. Alguna aurora, algún apagón de comunicaciones. Equilibrio aceptable.',effects:[{label:'Gestión magnética posible',cls:'si-pos'},{label:'Auroras ocasionales',cls:'si-neu'},{label:'Riesgo bajo',cls:'si-pos'}]},
    active:{title:'Actividad Estelar Activa',desc:'Tormentas solares frecuentes con eyecciones de masa coronal regulares. La radiación UV y X es alta. Los organismos sin pigmentación UV sufren daño genético. Las comunicaciones inalámbricas se interrumpen frecuentemente.',effects:[{label:'Alta radiación UV',cls:'si-neg'},{label:'Daño genético acelerado',cls:'si-neg'},{label:'Mutación acelerada',cls:'si-neg'}]},
    extreme:{title:'Actividad Estelar Extrema',desc:'Erupciones masivas continuas. La atmósfera es bombardeada con partículas de alta energía. Sin campo magnético suficiente el planeta pierde su envoltura gaseosa. La vida solo es posible bajo tierra o en el océano profundo.',effects:[{label:'Destruye atmósferas',cls:'si-neg'},{label:'Radiación letal en superficie',cls:'si-neg'},{label:'Mutación extrema',cls:'si-neg'},{label:'Vida subterránea/oceánica',cls:'si-neu'}]},
  },
  magneticField:{
    none:{title:'Sin Campo Magnético',desc:'La superficie queda expuesta directamente al viento estelar. Las partículas cargadas erosionan la atmósfera a lo largo de millones de años (como le ocurrió a Marte). La radiación cósmica llega sin filtro a la superficie.',effects:[{label:'Atmósfera erosionada',cls:'si-neg'},{label:'Radiación directa',cls:'si-neg'},{label:'Sin protección estelar',cls:'si-neg'}]},
    weak:{title:'Campo Magnético Débil',desc:'Protección parcial. El viento estelar erosiona lentamente las capas superiores de la atmósfera. La radiación cósmica es reducida pero no eliminada. Las criaturas desarrollan pigmentos protectores.',effects:[{label:'Erosión atmosférica lenta',cls:'si-neg'},{label:'Radiación moderada',cls:'si-neg'},{label:'Adaptaciones UV',cls:'si-neu'}]},
    'earth-like':{title:'Campo Magnético Terrestre',desc:'La magnetosfera desvía el 99% del viento solar y las partículas cargadas. Las auroras boreales son el único efecto visible. La atmósfera se preserva durante miles de millones de años. Estándar para la habitabilidad.',effects:[{label:'Atmósfera protegida',cls:'si-pos'},{label:'Radiación mínima',cls:'si-pos'},{label:'Auroras polares',cls:'si-neu'}]},
    strong:{title:'Campo Magnético Fuerte',desc:'Magnetosfera excepcionalmente potente que protege incluso en condiciones de alta actividad estelar. Puede extenderse cientos de radios planetarios. Las auroras cubren latitudes medias. Ventaja evolutiva enorme.',effects:[{label:'Protección total',cls:'si-pos'},{label:'Resiste erupciones extremas',cls:'si-pos'},{label:'Atmósfera permanente',cls:'si-pos'}]},
  },
  agua:{
    '0':{title:'Mundo Completamente Árido',desc:'Sin agua superficial. Todo el agua existente está atrapada en minerales hidratados o en el subsuelo profundo. El ciclo hidrológico no existe. La erosión es puramente eólica. Condiciones similares a Marte actual.',effects:[{label:'Sin ciclo hidrológico',cls:'si-neg'},{label:'Sin vida acuática',cls:'si-neg'},{label:'Erosión solo eólica',cls:'si-neg'}]},
    '10':{title:'Mares Interiores Dispersos',desc:'El 10% de la superficie tiene agua líquida, concentrada en cuencas interiores y pequeños mares cerrados. Sin océanos globales. El ciclo del agua existe pero es débil. La fauna acuática es limitada.',effects:[{label:'Ciclo hídrico débil',cls:'si-neg'},{label:'Vida acuática limitada',cls:'si-neu'},{label:'Llanuras áridas dominan',cls:'si-neg'}]},
    '30':{title:'Océanos Moderados',desc:'30% de agua, similar a un planeta con un único gran continente. Los océanos regulan el clima pero con menor inercia térmica que la Tierra. Las costas son muy extensas en relación a la masa terrestre.',effects:[{label:'Clima regulado',cls:'si-pos'},{label:'Costas extensas',cls:'si-pos'},{label:'Biodiversidad costera',cls:'si-pos'}]},
    '50':{title:'Equilibrio Tierra–Agua',desc:'La mitad de la superficie es tierra firme, la otra océano. El clima es más variable que en la Tierra porque los continentes calientan y enfrían más rápido que el mar. Ideal para la diversidad de ecosistemas.',effects:[{label:'Alta diversidad',cls:'si-pos'},{label:'Clima variable',cls:'si-neu'},{label:'Equilibrio ecológico',cls:'si-pos'}]},
    '71':{title:'Como la Tierra Actual',desc:'El 71% de agua, el 29% tierra. La proporción que la evolución terrestre conoce como referencia. Los océanos actúan como reguladores térmicos y reservorios de carbono. El ciclo del agua es completo y activo.',effects:[{label:'Clima estable',cls:'si-pos'},{label:'Biodiversidad máxima',cls:'si-pos'},{label:'Ciclo del agua completo',cls:'si-pos'}]},
    '85':{title:'Mundo Oceánico',desc:'Solo el 15% de la superficie emerge. Los continentes son pequeñas islas o archipiélagos. La vida marina domina. La civilización que surja será necesariamente anfibio-marina. La pesca y la navegación son fundamentales.',effects:[{label:'Civilización marina',cls:'si-neu'},{label:'Recursos pesqueros enormes',cls:'si-pos'},{label:'Tierra escasa',cls:'si-neg'}]},
    '95':{title:'Casi Todo Océano',desc:'Solo el 5% de tierra emerge, probable mente de origen volcánico. Los continentes como tales no existen. La vida terrestre, si existe, es reciente y en archipiélagos volcánicos. Mundo casi completamente acuático.',effects:[{label:'Tierra mínima',cls:'si-neg'},{label:'Vida totalmente oceánica',cls:'si-neu'},{label:'Sin agricultura terrestre',cls:'si-neg'}]},
  },
  precipitaciones:{
    arido:{title:'Régimen Árido (< 250 mm/año)',desc:'Menos de 250 mm de precipitación anual. Los desiertos dominan el paisaje. La vegetación solo sobrevive en oasis, costas y zonas de niebla. La erosión eólica crea dunas y mesas de roca. Similar al Sahara o al Atacama.',effects:[{label:'Desiertos dominantes',cls:'si-neg'},{label:'Agua subterránea crítica',cls:'si-neg'},{label:'Sin vegetación densa',cls:'si-neg'}]},
    estacional:{title:'Régimen Estacional (250–800 mm/año)',desc:'Lluvias concentradas en una o dos estaciones. El resto del año es seco. Praderas, sabanas y bosques caducifolios. La fauna migra siguiendo las lluvias. Permite agricultura de temporal. Equivalente a zonas mediterráneas.',effects:[{label:'Ciclos estacionales marcados',cls:'si-neu'},{label:'Agricultura de temporal',cls:'si-pos'},{label:'Biodiversidad moderada',cls:'si-neu'}]},
    frecuente:{title:'Régimen Frecuente (800–2000 mm/año)',desc:'Lluvias regulares durante gran parte del año. Bosques húmedos, ríos permanentes, lagos. La biodiversidad es muy alta. Los suelos son fértiles por la acumulación de materia orgánica. Condiciones tropicales.',effects:[{label:'Suelos muy fértiles',cls:'si-pos'},{label:'Biodiversidad alta',cls:'si-pos'},{label:'Ríos permanentes',cls:'si-pos'}]},
    tormentas:{title:'Tormentas Perpetuas (> 2000 mm/año)',desc:'Precipitaciones superiores a 2 metros anuales. El cielo permanece cubierto y las tormentas eléctricas son constantes. La erosión es brutal. Los ríos son torrenciales. La vida vegetal es exuberante pero las construcciones requieren materiales especiales.',effects:[{label:'Erosión brutal',cls:'si-neg'},{label:'Selvas densísimas',cls:'si-pos'},{label:'Relámpagos constantes',cls:'si-neg'},{label:'Tormentas eléctricas',cls:'si-neg'}]},
  },
  suelo:{
    rocoso:{title:'Suelo Rocoso — Litosfera Desnuda',desc:'La roca madre está expuesta o cubierta por una delgada capa de regolito. Poca materia orgánica. La erosión física domina. Los minerales metálicos son accesibles. Dificulta la agricultura pero facilita la minería.',effects:[{label:'Minería fácil',cls:'si-pos'},{label:'Agricultura difícil',cls:'si-neg'},{label:'Materiales de construcción',cls:'si-pos'}]},
    arenoso:{title:'Suelo Arenoso — Regolito y Dunas',desc:'Partículas finas transportadas por el viento crean dunas y planicies arenosas. Muy baja retención de agua. La materia orgánica no se acumula. Civilizaciones en desiertos de arena desarrollan tecnología hídrica avanzada.',effects:[{label:'Retención hídrica baja',cls:'si-neg'},{label:'Agricultura mínima',cls:'si-neg'},{label:'Construcción difícil',cls:'si-neg'},{label:'Tecnología hídrica forzada',cls:'si-pos'}]},
    volcanico:{title:'Suelo Volcánico — Basalto y Ceniza',desc:'La ceniza volcánica enriquece el suelo con minerales raros: potasio, fósforo, silicio. Históricamente las tierras más fértiles de la Tierra están junto a volcanes. Alta actividad geotérmica aprovechable.',effects:[{label:'Muy fértil a largo plazo',cls:'si-pos'},{label:'Riesgo volcánico',cls:'si-neg'},{label:'Energía geotérmica',cls:'si-pos'},{label:'Minerales raros',cls:'si-pos'}]},
    selvatico:{title:'Suelo Selvático — Orgánico Rico',desc:'Capas gruesas de humus y materia orgánica en descomposición. Paradójicamente el suelo profundo es pobre en nutrientes (están en la biomasa, no en la tierra). Biodiversidad sin parangón. Recursos medicinales y farmacéuticos extraordinarios.',effects:[{label:'Biodiversidad máxima',cls:'si-pos'},{label:'Recursos medicinales',cls:'si-pos'},{label:'Suelo profundo pobre',cls:'si-neg'},{label:'Humus rico superficial',cls:'si-pos'}]},
    helado:{title:'Suelo Helado — Permafrost',desc:'El suelo está congelado de forma permanente a pocos centímetros de profundidad. Solo la capa activa superficial se descongela en verano. Imposible agricultura convencional. Las raíces no penetran. Conserva perfectamente restos orgánicos.',effects:[{label:'Agricultura imposible',cls:'si-neg'},{label:'Conservación perfecta',cls:'si-neu'},{label:'Suelo impermeable',cls:'si-neg'}]},
    salino:{title:'Suelo Salino — Evaporítico',desc:'Planicies de sal formadas por la evaporación de antiguos mares interiores. Altamente reflectantes. Tóxicas para la mayoría de plantas. Las civilizaciones aquí aprenden a desalinizar y a comerciar con sal como recurso estratégico.',effects:[{label:'Tóxico para plantas',cls:'si-neg'},{label:'Sal como recurso',cls:'si-pos'},{label:'Alta reflectividad',cls:'si-neu'},{label:'Sin vegetación',cls:'si-neg'}]},
  },
  tipo_fisico:{
    humanoide:{title:'Morfología Humanoide',desc:'Cuerpo bípedo con dos extremidades superiores prensiles y dos inferiores locomotoras. El bipedismo libera las manos para la fabricación de herramientas. El cerebro grande requiere gran aporte calórico. Comunicación vocal compleja.',effects:[{label:'Fabricación de herramientas',cls:'si-pos'},{label:'Comunicación vocal',cls:'si-pos'},{label:'Alto consumo calórico',cls:'si-neg'}]},
    reptiliano:{title:'Morfología Reptiliana',desc:'Cuerpo escamado con temperatura corporal regulada por el entorno (ectotermo). Mayor resistencia a la radiación y temperaturas extremas. Regeneración de extremidades posible. Metabolismo más lento pero enormemente eficiente.',effects:[{label:'Resistencia extrema',cls:'si-pos'},{label:'Metabolismo eficiente',cls:'si-pos'},{label:'Dependiente del calor externo',cls:'si-neg'}]},
    insectoide:{title:'Morfología Insectoide',desc:'Exoesqueleto de quitina que actúa como armadura natural. Seis o más extremidades permiten especialización funcional. Comunicación feromonal y vibracional. La colonia puede funcionar como superorganismo. Escalan mal con la gravedad.',effects:[{label:'Armadura natural',cls:'si-pos'},{label:'Superorganismo colonial',cls:'si-pos'},{label:'Mal escalado gravitacional',cls:'si-neg'},{label:'Comunicación química',cls:'si-neu'}]},
    energetico:{title:'Ser Energético',desc:'Entidad sin forma física definida compuesta de energía coherente. Inmune a condiciones ambientales físicas extremas. Puede existir en el vacío. La civilización que forman trasciende los límites del planeta natal desde muy pronto.',effects:[{label:'Inmune al entorno físico',cls:'si-pos'},{label:'Existe en el vacío',cls:'si-pos'},{label:'Sin necesidades materiales',cls:'si-pos'},{label:'Muy difícil de entender',cls:'si-neg'}]},
  },
  altura:{
    baja:{title:'Especie Baja (0.5–1.2 m)',desc:'Talla compacta que reduce las necesidades calóricas y favorece la agilidad. En planetas con alta gravedad es la morfología dominante. El centro de gravedad bajo facilita el equilibrio. Buena relación superficie/volumen para regular temperatura.',effects:[{label:'Bajo consumo energético',cls:'si-pos'},{label:'Alta agilidad',cls:'si-pos'},{label:'Óptima en alta gravedad',cls:'si-pos'}]},
    media:{title:'Especie de Talla Media (1.2–2.0 m)',desc:'El rango de talla con mayor versatilidad evolutiva conocida. Equilibrio entre visibilidad predatoria, alcance de las extremidades superiores y coste energético. La Tierra lo ha seleccionado como óptimo para primates inteligentes.',effects:[{label:'Máxima versatilidad',cls:'si-pos'},{label:'Equilibrio energético',cls:'si-pos'}]},
    alta:{title:'Especie Alta (2.0–3.5 m)',desc:'Mayor alcance visual y de extremidades. Ventaja en la depredación y en la construcción de estructuras. Requiere más calorías y tiene mayor superficie de exposición. Menos ágil pero más intimidante. En baja gravedad es muy común.',effects:[{label:'Mayor alcance',cls:'si-pos'},{label:'Mayor consumo calórico',cls:'si-neg'},{label:'Menos ágil',cls:'si-neg'},{label:'Óptima en baja gravedad',cls:'si-pos'}]},
    gigante:{title:'Especie Gigante (+3.5 m)',desc:'Talla ciclópea que solo es viable en planetas con gravedad baja o atmosfera densa que ayude a soportar el peso. Pueden mover objetos masivos sin maquinaria. Su enorme cerebro puede tener mayor capacidad pero también mayor coste metabólico.',effects:[{label:'Fuerza excepcional',cls:'si-pos'},{label:'Solo viable en baja gravedad',cls:'si-neg'},{label:'Enorme coste metabólico',cls:'si-neg'}]},
  },
  metabolismo:{
    carnivoro:{title:'Metabolismo Carnívoro',desc:'Dieta basada en proteínas animales de alta densidad calórica. Instintos de caza muy desarrollados, reflejos rápidos y sentidos agudos. La cooperación para la caza fomenta la formación de grupos y jerarquías sociales. Limitado por la disponibilidad de presas.',effects:[{label:'Reflejos y sentidos agudos',cls:'si-pos'},{label:'Cooperación de caza',cls:'si-pos'},{label:'Dependiente de presas',cls:'si-neg'}]},
    herbivoro:{title:'Metabolismo Herbívoro',desc:'Dieta vegetal que requiere mayor volumen de ingestión pero elimina la necesidad de cazar. Los herbívoros inteligentes desarrollan filosofías pacifistas y estructuras colectivas de defensa. Los primeros en domesticar plantas y crear agricultura.',effects:[{label:'Filosofía pacifista',cls:'si-pos'},{label:'Primera agricultura',cls:'si-pos'},{label:'Mayor volumen de ingesta',cls:'si-neg'}]},
    omnivoro:{title:'Metabolismo Omnívoro',desc:'El generalista por excelencia. Puede explotar casi cualquier fuente de energía disponible. Esta adaptabilidad es la mayor ventaja competitiva conocida. La especie puede colonizar prácticamente cualquier bioma del planeta.',effects:[{label:'Máxima adaptabilidad',cls:'si-pos'},{label:'Coloniza cualquier bioma',cls:'si-pos'},{label:'Ventaja competitiva máxima',cls:'si-pos'}]},
    fotosintetico:{title:'Metabolismo Fotosintético',desc:'Absorción directa de energía estelar a través de pigmentos en la piel. No necesitan comer ni beber en condiciones de luz adecuada. Sin embargo son dependientes de la iluminación y en noches largas o climas nublados el metabolismo se ralentiza drásticamente.',effects:[{label:'Sin necesidad de alimento',cls:'si-pos'},{label:'Dependiente de la luz',cls:'si-neg'},{label:'Lento en oscuridad',cls:'si-neg'},{label:'Energía solar directa',cls:'si-pos'}]},
  },
  religion:{
    cosmico:{title:'Animismo Cósmico',desc:'La especie interpreta los fenómenos naturales (tormentas, eclipses, volcanes) como manifestaciones de entidades conscientes. Esta visión fomenta la observación detallada del entorno y sienta las bases de la astronomía y la meteorología primitivas.',effects:[{label:'Base para la astronomía',cls:'si-pos'},{label:'Cohesión social alta',cls:'si-pos'},{label:'Resistencia al racionalismo',cls:'si-neg'}]},
    naturaleza:{title:'Culto a la Naturaleza',desc:'Veneración del ecosistema local como entidad sagrada. Promueve la conservación del medio ambiente y el conocimiento profundo de plantas y animales. Base para la botánica, zoología y medicina primitivas. Tendencia al equilibrio con el entorno.',effects:[{label:'Conocimiento botánico',cls:'si-pos'},{label:'Conservación ambiental',cls:'si-pos'},{label:'Desarrollo tecnológico lento',cls:'si-neg'}]},
    ancestros:{title:'Veneración Ancestral',desc:'Los muertos guían a los vivos a través de rituales y oráculos. Fuerte continuidad cultural e histórica. Los registros del pasado se preservan con celo. Tiende a la conservadurismo social pero produce archivos históricos extraordinariamente detallados.',effects:[{label:'Continuidad cultural',cls:'si-pos'},{label:'Historia preservada',cls:'si-pos'},{label:'Conservadurismo social',cls:'si-neg'}]},
    ciencia:{title:'Empirismo Primitivo',desc:'La observación y la experimentación como método para entender el mundo, desde la prehistoria. Esta disposición racional acelera enormemente el desarrollo tecnológico pero puede generar tensiones con el orden social establecido.',effects:[{label:'Tecnología acelerada',cls:'si-pos'},{label:'Pensamiento crítico',cls:'si-pos'},{label:'Tensión con el poder',cls:'si-neg'}]},
  },
};

function updateSelectInfos(){
  Object.entries(SELECT_INFO).forEach(([selectId,values])=>{
    const el=document.getElementById(selectId);
    const infoEl=document.getElementById('info-'+selectId);
    if(!el||!infoEl)return;
    const val=el.value;
    const info=values[val];
    if(!info){infoEl.innerHTML='';return}
    const tagsHtml=info.effects.map(e=>`<span class="si-tag ${e.cls}">${e.label}</span>`).join('');
    infoEl.innerHTML=`<strong>${info.title}</strong>${info.desc}<div class="si-effects">${tagsHtml}</div>`;
  });
}


function readData(){
  const ids=['tamano','estrella','distancia','temperatura','atmosfera','geologia','stellarActivity','magneticField','agua','precipitaciones','suelo','tipo_fisico','altura','metabolismo','religion'];
  const d={};ids.forEach(id=>{const el=document.getElementById(id);if(el)d[id]=el.value});return d;
}
function applyConstraints(){
  const d=readData(),aw=parseInt(d.agua),reasons=[];
  function setDis(sid,blocked,reason){const sel=document.getElementById(sid);if(!sel)return;let hit=false;Array.from(sel.options).forEach(o=>{o.disabled=blocked.includes(o.value);if(o.disabled&&o.selected)hit=true});if(hit){const fv=Array.from(sel.options).find(o=>!o.disabled);if(fv)sel.value=fv.value;reasons.push(reason)}}
  document.querySelectorAll('select').forEach(s=>Array.from(s.options).forEach(o=>o.disabled=false));
  if(d.tamano==='mininetuno')setDis('atmosfera',['tenue','delgada','terrestre','densa'],'🪐 Mini-Neptuno retiene solo H₂/He (≥10 atm).');
  if(d.tamano==='enano')setDis('atmosfera',['muy_densa'],'🪐 Planeta enano: gravedad insuficiente para 10 atm.');
  if(d.atmosfera==='tenue'){setDis('precipitaciones',['tormentas','frecuente'],'💨 Atmósfera tenue: sin ciclo hidrológico.');setDis('temperatura',['caliente'],'💨 Atmósfera tenue: no retiene calor.')}
  if(d.atmosfera==='muy_densa')setDis('temperatura',['helado'],'⚗️ 10 atm: efecto invernadero impide <−50°C.');
  if(aw===0)setDis('precipitaciones',['tormentas','frecuente'],'🏜️ Sin agua: sin ciclo hidrológico.');
  if(aw===0||d.precipitaciones==='arido'||aw<=10||d.temperatura==='helado')setDis('suelo',['selvatico'],'🌵 Suelo selvático requiere humedad.');
  if(d.estrella==='enana_roja')setDis('distancia',['lejano','muy_lejano'],'🔴 Enana roja: ZH muy cercana.');
  if(d.estrella==='subgigante_f')setDis('distancia',['muy_cercano'],'⭐ Subgigante F: muy cerca = Venus.');
  if(d.geologia==='extrema')setDis('agua',['85','95'],'🌋 Geología extrema acidificaría océanos.');
  if(d.magneticField==='none')setDis('atmosfera',['densa','muy_densa'],'🧲 Sin campo: atmósferas densas se erosionan.');
  const ban=document.getElementById('constraint-banner');
  if(reasons.length){ban.innerHTML='<strong>⚠ RESTRICCIONES</strong><br>'+reasons.join('<br>');ban.classList.add('show');clearTimeout(ban._t);ban._t=setTimeout(()=>ban.classList.remove('show'),5000)}else ban.classList.remove('show');
}
function updatePlanet(){
  applyConstraints();
  updateSelectInfos();
  const d=readData(),tam=PHYS.tamano[d.tamano],atm=PHYS.atmosfera[d.atmosfera],temp=PHYS.temperatura[d.temperatura],hab=calcHab(d),surf=calcSurface(d);
  document.getElementById('stat-radio').textContent=tam.radio;
  document.getElementById('stat-gravedad').textContent=tam.gravedad;
  document.getElementById('stat-anio').textContent=calcYear(d)+' días';
  document.getElementById('stat-presion').textContent=atm.label;
  document.getElementById('stat-temp').textContent=temp.label;
  const he=document.getElementById('stat-hab');he.textContent=hab+'/100';he.style.color=hab>=70?'var(--green)':hab>=40?'var(--amber)':'var(--red)';
  document.getElementById('pct-tierra').textContent=surf.land;document.getElementById('pct-agua').textContent=surf.water;document.getElementById('pct-hielo').textContent=surf.ice;
  document.getElementById('bar-tierra').style.width=surf.land+'%';document.getElementById('bar-agua').style.width=surf.water+'%';document.getElementById('bar-hielo').style.width=surf.ice+'%';
  const tw=document.getElementById('traits-config');if(tw){const traits=calcTraits(d);tw.innerHTML='';traits.slice(0,5).forEach(t=>{const s=document.createElement('span');s.className='trait-tag'+(t.cls?' '+t.cls:'');s.title=t.desc;s.textContent=t.icon+' '+t.label;tw.appendChild(s)})}
  const warns=[];const aw2=parseInt(d.agua);if(d.temperatura==='caliente'&&aw2>50)warns.push('⚠ Alta temp + mucha agua → invernadero potencial.');if(d.tamano==='mininetuno'&&d.atmosfera!=='muy_densa')warns.push('⚠ Mini-Neptuno necesita atmósfera muy densa.');
  const wEl=document.getElementById('compat-warning');if(warns.length){wEl.innerHTML=warns.join('<br>');wEl.classList.add('show')}else wEl.classList.remove('show');
}

/* ══════════ TRAITS ══════════ */
function calcTraits(d){
  const t=[],temp=PHYS.temperatura[d.temperatura].c,aw=parseInt(d.agua),atm=PHYS.atmosfera[d.atmosfera].atm,lum=PHYS.estrella[d.estrella].lum;
  if(temp<-20)t.push({icon:'🧊',label:'Metabolismo lento',cls:'',desc:'Hibernación y longevidad.'});
  if(temp>=60)t.push({icon:'🔥',label:'Termorresistencia',cls:'danger',desc:'Proteínas termoestables.'});
  if(aw>70)t.push({icon:'🌊',label:'Anfibios',cls:'positive',desc:'Respiran bajo el agua.'});
  if(aw<=10)t.push({icon:'🏜️',label:'Ciclo hídrico cerrado',cls:'warn',desc:'Riñones ultraficientes.'});
  if(atm<0.4)t.push({icon:'💨',label:'Pulmones hiperdesarrollados',cls:'',desc:'O₂ en atmósferas tenues.'});
  if(lum>=2)t.push({icon:'🕶️',label:'Pigmentación UV',cls:'warn',desc:'Contra radiación intensa.'});
  if(lum<=0.1)t.push({icon:'👁️',label:'Visión infrarroja',cls:'positive',desc:'Ven en el espectro IR.'});
  if(d.geologia==='extrema'||d.geologia==='alta')t.push({icon:'🌋',label:'Tolerancia CO₂',cls:'danger',desc:'Hemoglobina adaptada.'});
  if(d.precipitaciones==='tormentas')t.push({icon:'⚡',label:'Electrorreceptores',cls:'positive',desc:'Detectan campos EM.'});
  if(d.tamano==='enano')t.push({icon:'🦅',label:'Locomoción aérea',cls:'positive',desc:'Vuelan en baja gravedad.'});
  if(d.magneticField==='none')t.push({icon:'🧲',label:'Alta mutación',cls:'danger',desc:'Sin escudo magnético.'});
  if(d.stellarActivity==='extreme')t.push({icon:'☢️',label:'Reparación celular',cls:'danger',desc:'ADN se repara rápido.'});
  t.forEach((tr,i)=>tr.delay=i*60);return t;
}

/* ══════════ NAMES ══════════ */
const pfx=['Zar','Keth','Vor','Aex','Nul','Thar','Xen','Omi','Sol','Rel','Vek','Aek','Zeth'];
const mid=["'ath","ian","ox","ul","en","ar","ix","ak","or","el","em","ys"];
const sfx=[' Imperio',' Colmena',' Hegemonía',' Dominion',' Alianza',' Confederación',' Régimen',' Orden'];
function genName(){return pfx[Math.floor(Math.random()*pfx.length)]+mid[Math.floor(Math.random()*mid.length)]+sfx[Math.floor(Math.random()*sfx.length)]}

/* ══════════ EVOLUTION LINES ══════════ */
const EVO={
  tribal:      {icon:'🔥',name:'Tribal',    gov:'Tribal',          eco:'Subsistencia',  mil:'Sin ejército',      periodo:'Era Primordial'},
  agricola:    {icon:'🌾',name:'Agrícola',  gov:'Caudillo',        eco:'Agraria',       mil:'Milicias tribales', periodo:'Era Agrícola'},
  ciudades:    {icon:'🏛️',name:'Ciudades',  gov:'Consejo',         eco:'Comercial',     mil:'Guardia urbana',    periodo:'Era Urbana'},
  nacion:      {icon:'⚑', name:'Nación',   gov:'Monarquía',       eco:'Mercantil',     mil:'Ejército nacional', periodo:'Era Imperial'},
  industrial:  {icon:'⚙️',name:'Industrial',gov:'Tecnocracia',     eco:'Industrial',    mil:'Ejército moderno',  periodo:'Era Industrial'},
  planetario:  {icon:'🌍',name:'Planetario',gov:'República global',eco:'Tecnológica',   mil:'Fuerzas orbitales', periodo:'Era Planetaria'},
  orbital:     {icon:'🛰️',name:'Orbital',  gov:'IA Asistida',     eco:'Energética',    mil:'Flota orbital',     periodo:'Era Espacial'},
  sistema:     {icon:'☀️',name:'Sistema',  gov:'IA Gobernante',   eco:'Estelar',       mil:'Flotas',            periodo:'Era Estelar'},
  interestelar:{icon:'🚀',name:'Interestelar',gov:'Consejo galáctico',eco:'Interestelar',mil:'IA de combate',   periodo:'Era Interestelar'},
  galactico:   {icon:'🌌',name:'Galáctico', gov:'Mente colectiva', eco:'Post-escasez',  mil:'IAs militares',     periodo:'Era Galáctica'},
  trascendente:{icon:'✨',name:'Trascendente',gov:'Trascendente',  eco:'Trascendente',  mil:'Trascendente',      periodo:'Era Trascendente'},
};
const EVO_LINES={
  oceanico:   ['tribal','agricola','ciudades','nacion','industrial','planetario','orbital','sistema','interestelar','galactico','trascendente'],
  volcanico:  ['tribal','ciudades','nacion','industrial','planetario','orbital','sistema','interestelar','galactico','trascendente'],
  helado:     ['tribal','ciudades','industrial','planetario','orbital','sistema','interestelar','galactico','trascendente'],
  arido:      ['tribal','ciudades','nacion','industrial','planetario','orbital','sistema','interestelar','galactico'],
  enano:      ['tribal','ciudades','orbital','sistema','interestelar','galactico','trascendente'],
  supertierra:['tribal','agricola','ciudades','nacion','industrial','planetario','sistema','interestelar','galactico','trascendente'],
  estandar:   ['tribal','agricola','ciudades','nacion','industrial','planetario','orbital','sistema','interestelar','galactico','trascendente'],
};
// Turno mínimo para desbloquear cada índice en la línea
const EVO_THRESHOLDS=[0,40,100,180,280,400,540,680,820,940,990];

function buildEvoLine(d){
  const aw=parseInt(d.agua);
  if(aw>=85)return EVO_LINES.oceanico;
  if(d.suelo==='volcanico'||d.geologia==='extrema')return EVO_LINES.volcanico;
  if(d.temperatura==='helado')return EVO_LINES.helado;
  if(d.precipitaciones==='arido'&&aw<=10)return EVO_LINES.arido;
  if(d.tamano==='enano')return EVO_LINES.enano;
  if(d.tamano==='supertierra'||d.tamano==='mininetuno')return EVO_LINES.supertierra;
  return EVO_LINES.estandar;
}

/* ══════════════════════════════════════════════════
   CATÁLOGO DE EVENTOS CON ÉPOCAS Y DECISIONES
   Cada evento: {id, epoch[], type, icon, title, desc(gs), decisions[3]}
   Cada decisión: {letter, title, desc, effects{}, trait?, unlocks[], blocks[]}
   epoch: array de epoch keys que pueden generar este evento
══════════════════════════════════════════════════ */
const EPOCHS=['tribal','agricola','ciudades','nacion','industrial','planetario','orbital','sistema','interestelar','galactico'];

const EVENT_CATALOG=[

  // ══ ERA TRIBAL ══
  {id:'caza_mayor',epoch:['tribal'],type:'social',icon:'🦣',
   title:'La Gran Cacería',
   desc:gs=>`Una manada de criaturas colosales ha llegado al territorio. Cazarlas alimentaría a ${gs.name} por una generación.`,
   decisions:[
     {letter:'A',title:'Cacería colectiva',desc:'Todo el clan caza junto. Alta recompensa, riesgo real.',effects:{poder:+4,estabilidad:+3,poblacion:+5},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['expansion_tribal'],blocks:[]},
     {letter:'B',title:'Caza selectiva',desc:'Solo los mejores cazadores actúan. Menor riesgo, menor botín.',effects:{poder:+2,estabilidad:+5,tecnologia:+1},trait:null,unlocks:[],blocks:[]},
     {letter:'C',title:'Desviar la manada',desc:'Usamos fuego y ruido para alejarla. No hay botín, pero no hay bajas.',effects:{estabilidad:+2,tecnologia:+3},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['fuego_sagrado'],blocks:['expansion_tribal']},
   ]},
  {id:'sequia_tribal',epoch:['tribal'],type:'catastrofe',icon:'🏜️',
   title:'La Gran Sequía',
   desc:gs=>`Las lluvias han cesado. Los ríos de ${gs.name} se secan. La tribu debe actuar o perecer.`,
   decisions:[
     {letter:'A',title:'Migrar al norte',desc:'Abandonamos el territorio ancestral buscando agua. Pérdida cultural, supervivencia garantizada.',effects:{estabilidad:-4,poder:-2,poblacion:+2},trait:null,unlocks:['nuevas_tierras'],blocks:['ciudad_fundada']},
     {letter:'B',title:'Cavar pozos profundos',desc:'Usamos conocimiento geológico primitivo para encontrar agua subterránea.',effects:{tecnologia:+5,estabilidad:+2,poder:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['irrigacion'],blocks:[]},
     {letter:'C',title:'Ritual de lluvia',desc:'El chamán lidera ritos para invocar la lluvia. Cohesión espiritual, pero resultados inciertos.',effects:{estabilidad:+6,poder:-1},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:['religion_organizada'],blocks:['irrigacion']},
   ]},
  {id:'tribu_rival',epoch:['tribal'],type:'militar',icon:'⚔️',
   title:'La Tribu del Este',
   desc:gs=>`Una tribu rival reclama el territorio fértil que sustenta a ${gs.name}. Sus guerreros son numerosos.`,
   decisions:[
     {letter:'A',title:'Combate abierto',desc:'Enfrentamos a la tribu rival en batalla campal. Victoria o derrota sin matices.',effects:{poder:+7,estabilidad:-5,poblacion:-8},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['alianza_militar'],blocks:['diplomacia_temprana']},
     {letter:'B',title:'Negociar el territorio',desc:'Proponemos compartir los recursos mediante acuerdos. Pioneros de la diplomacia.',effects:{estabilidad:+5,tecnologia:+2},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['diplomacia_temprana'],blocks:['expansion_tribal']},
     {letter:'C',title:'Emboscada nocturna',desc:'Atacamos de noche con un grupo pequeño. Alta eficacia, baja moralidad.',effects:{poder:+5,estabilidad:-2,poblacion:-3},trait:null,unlocks:[],blocks:['diplomacia_temprana']},
   ]},
  {id:'fuego_sagrado',epoch:['tribal'],type:'cultural',icon:'🔥',
   title:'El Don del Fuego',
   desc:gs=>`Un miembro de ${gs.name} descubre cómo crear fuego a voluntad. Esto cambia todo.`,
   decisions:[
     {letter:'A',title:'El fuego es sagrado',desc:'Lo convertimos en rito religioso. Poder al chamán.',effects:{estabilidad:+7,poder:+2},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:['religion_organizada'],blocks:[]},
     {letter:'B',title:'El fuego es herramienta',desc:'Lo enseñamos a todos. La tribu entera progresa.',effects:{tecnologia:+6,estabilidad:+3},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['metalurgia'],blocks:[]},
     {letter:'C',title:'El fuego es arma',desc:'Lo usamos para intimidar y combatir a enemigos.',effects:{poder:+5,estabilidad:-1},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['expansion_tribal'],blocks:[]},
   ]},
  {id:'expansion_tribal',epoch:['tribal'],type:'expansion',icon:'🌄',
   title:'Nuevos Horizontes',
   desc:gs=>`Exploradores de ${gs.name} han descubierto tierras fértiles más allá de las montañas.`,
   decisions:[
     {letter:'A',title:'Colonizar agresivamente',desc:'Enviamos guerreros y colonos. Expandimos el territorio a la fuerza.',effects:{poder:+6,estabilidad:-3,territorio:+1},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['ciudad_fundada'],blocks:[]},
     {letter:'B',title:'Exploración pacífica',desc:'Enviamos comerciantes y negociadores. Intercambio cultural.',effects:{tecnologia:+3,estabilidad:+4},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['comercio_primitivo'],blocks:[]},
     {letter:'C',title:'Mantenerse en casa',desc:'Reforzamos y defendemos lo que ya tenemos.',effects:{estabilidad:+6,poder:+2},trait:null,unlocks:[],blocks:['ciudad_fundada']},
   ]},

  // ══ ERA AGRÍCOLA ══
  {id:'primera_cosecha',epoch:['agricola'],type:'social',icon:'🌾',
   title:'La Primera Cosecha',
   desc:gs=>`${gs.name} ha domesticado las primeras plantas cultivables. La era nómada termina.`,
   decisions:[
     {letter:'A',title:'Aldeas permanentes',desc:'Fundamos asentamientos fijos alrededor de los campos.',effects:{estabilidad:+8,poblacion:+10},trait:null,unlocks:['ciudad_fundada'],blocks:[]},
     {letter:'B',title:'Agricultura intensiva',desc:'Maximizamos la producción con técnicas avanzadas.',effects:{tecnologia:+5,poblacion:+8,estabilidad:+3},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['irrigacion','comercio_primitivo'],blocks:[]},
     {letter:'C',title:'Reservas estratégicas',desc:'Guardamos excedentes para tiempos difíciles. Precaución ante todo.',effects:{estabilidad:+6,poder:+3},trait:null,unlocks:[],blocks:[]},
   ]},
  {id:'irrigacion',epoch:['agricola'],type:'cientifico',icon:'💧',
   title:'El Sistema de Irrigación',
   desc:gs=>`Ingenieros de ${gs.name} proponen canalizar los ríos para regar campos lejanos.`,
   decisions:[
     {letter:'A',title:'Gran obra pública',desc:'Movilizamos a toda la población. Enorme logro, enorme esfuerzo.',effects:{tecnologia:+7,estabilidad:-2,poder:+4},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['metalurgia','ciudad_fundada'],blocks:[]},
     {letter:'B',title:'Proyecto cooperativo',desc:'Cada aldea construye su sección. Progreso lento pero sostenible.',effects:{tecnologia:+4,estabilidad:+5},trait:null,unlocks:['comercio_primitivo'],blocks:[]},
     {letter:'C',title:'Solo los más ricos',desc:'Solo las élites financian y controlan el agua.',effects:{poder:+6,estabilidad:-4,tecnologia:+3},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:[],blocks:['religion_organizada']},
   ]},
  {id:'religion_organizada',epoch:['agricola','ciudades'],type:'cultural',icon:'🛕',
   title:'El Primer Templo',
   desc:gs=>`Líderes espirituales de ${gs.name} proponen construir un templo permanente al dios protector.`,
   decisions:[
     {letter:'A',title:'El templo domina todo',desc:'El clero controla la política y la economía. Teocracia plena.',effects:{estabilidad:+8,poder:+3,tecnologia:-2},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:['calendario_sagrado'],blocks:['primera_ciencia']},
     {letter:'B',title:'Religión civil',desc:'El Estado controla el templo. La fe sirve al poder político.',effects:{poder:+5,estabilidad:+5},trait:null,unlocks:[],blocks:[]},
     {letter:'C',title:'Pluralismo espiritual',desc:'Permitimos múltiples cultos. La sociedad es más libre pero menos unida.',effects:{tecnologia:+4,estabilidad:+2,poder:-1},trait:{id:'científica',label:'🔬 Científica'},unlocks:['primera_ciencia'],blocks:['teocracia_total']},
   ]},
  {id:'comercio_primitivo',epoch:['agricola','ciudades'],type:'social',icon:'🪙',
   title:'Las Primeras Rutas Comerciales',
   desc:gs=>`Mercaderes de ${gs.name} establecen contacto con comunidades lejanas. El trueque cede paso al comercio.`,
   decisions:[
     {letter:'A',title:'Libre mercado',desc:'Dejamos que el comercio fluya sin restricciones. Riqueza y caos.',effects:{poder:+3,estabilidad:-2,tecnologia:+4,poblacion:+5},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:['escritura','moneda'],blocks:[]},
     {letter:'B',title:'Comercio regulado',desc:'El Estado cobra impuestos y controla las rutas. Menos libertad, más orden.',effects:{poder:+5,estabilidad:+4,tecnologia:+2},trait:null,unlocks:['escritura'],blocks:[]},
     {letter:'C',title:'Autarquía',desc:'Producimos todo localmente. Independientes pero estancados.',effects:{estabilidad:+6,poder:+2,tecnologia:-1},trait:null,unlocks:[],blocks:['moneda','escritura']},
   ]},

  // ══ ERA CIUDADES ══
  {id:'ciudad_fundada',epoch:['ciudades'],type:'social',icon:'🏙️',
   title:'La Gran Ciudad',
   desc:gs=>`El asentamiento central de ${gs.name} ha crecido hasta convertirse en una verdadera ciudad.`,
   decisions:[
     {letter:'A',title:'Ciudad muro',desc:'Construimos grandes murallas. Defendible, pero cerrada al exterior.',effects:{poder:+6,estabilidad:+4,tecnologia:+2},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['primer_ejercito'],blocks:['ciudad_comercial']},
     {letter:'B',title:'Ciudad mercado',desc:'Diseñamos la ciudad en torno al comercio. Puerto, mercados, bienvenida a todos.',effects:{tecnologia:+4,poblacion:+12,estabilidad:+3},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:['ciudad_comercial','moneda'],blocks:[]},
     {letter:'C',title:'Ciudad sagrada',desc:'El templo es el corazón de la ciudad. Peregrinaje y poder religioso.',effects:{estabilidad:+8,poder:+3},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:['teocracia_total'],blocks:['primera_ciencia']},
   ]},
  {id:'escritura',epoch:['ciudades'],type:'cientifico',icon:'📜',
   title:'El Nacimiento de la Escritura',
   desc:gs=>`Sabios de ${gs.name} han desarrollado un sistema de símbolos para registrar conocimiento.`,
   decisions:[
     {letter:'A',title:'Escritura para todos',desc:'Enseñamos a leer y escribir a toda la ciudadanía.',effects:{tecnologia:+8,estabilidad:+3,poder:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['primera_ciencia','leyes_escritas'],blocks:[]},
     {letter:'B',title:'Reservada al clero',desc:'Solo los sacerdotes conocen la escritura. Control del conocimiento.',effects:{poder:+5,estabilidad:+4,tecnologia:+2},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:['teocracia_total'],blocks:['primera_ciencia']},
     {letter:'C',title:'Escritura comercial',desc:'Se usa principalmente para registros económicos. Pragmática.',effects:{tecnologia:+4,poder:+3,estabilidad:+2},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:['moneda'],blocks:[]},
   ]},
  {id:'leyes_escritas',epoch:['ciudades','nacion'],type:'politico',icon:'⚖️',
   title:'El Código de Leyes',
   desc:gs=>`Juristas de ${gs.name} proponen redactar el primer código legal que obligue a todos por igual.`,
   decisions:[
     {letter:'A',title:'Igualdad ante la ley',desc:'Las leyes aplican a nobles y plebeyos. Justicia universal.',effects:{estabilidad:+10,poder:+2,tecnologia:+1},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['democracia_primitiva'],blocks:[]},
     {letter:'B',title:'Ley del más fuerte',desc:'Las leyes favorecen a la aristocracia militar.',effects:{poder:+8,estabilidad:-2},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['primer_ejercito'],blocks:['democracia_primitiva']},
     {letter:'C',title:'Ley comercial',desc:'Las leyes protegen contratos y propiedad. El mercado es soberano.',effects:{poder:+4,estabilidad:+5,tecnologia:+2},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:['moneda'],blocks:[]},
   ]},
  {id:'primera_ciencia',epoch:['ciudades','nacion'],type:'cientifico',icon:'🔭',
   title:'Los Primeros Filósofos',
   desc:gs=>`En ${gs.name} surge una clase de pensadores que cuestionan los mitos y buscan explicaciones naturales.`,
   decisions:[
     {letter:'A',title:'Academias financiadas',desc:'El Estado financia escuelas de pensamiento libre.',effects:{tecnologia:+9,estabilidad:+2,poder:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['matematicas','ingenieria'],blocks:[]},
     {letter:'B',title:'Ciencia al servicio del Estado',desc:'La investigación se dirige a usos militares e industriales.',effects:{poder:+6,tecnologia:+5},trait:null,unlocks:['ingenieria'],blocks:[]},
     {letter:'C',title:'Persecución de los filósofos',desc:'Amenazan el orden religioso. Son silenciados.',effects:{estabilidad:+3,poder:+2,tecnologia:-3},trait:{id:'teocrática',label:'📖 Teocrática'},unlocks:[],blocks:['matematicas','ingenieria']},
   ]},

  // ══ ERA NACIÓN / INDUSTRIAL ══
  {id:'primer_ejercito',epoch:['nacion','industrial'],type:'militar',icon:'⚔️',
   title:'El Ejército Profesional',
   desc:gs=>`${gs.name} funda su primer ejército permanente de soldados profesionales.`,
   decisions:[
     {letter:'A',title:'Ejército conquistador',desc:'Entrenado para la expansión territorial agresiva.',effects:{poder:+10,estabilidad:-3,territorio:+1},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['gran_conquista'],blocks:['tratado_paz']},
     {letter:'B',title:'Ejército defensor',desc:'Su misión es proteger las fronteras actuales.',effects:{poder:+5,estabilidad:+5},trait:null,unlocks:['tratado_paz'],blocks:[]},
     {letter:'C',title:'Guardia real',desc:'El ejército sirve principalmente al poder central.',effects:{poder:+7,estabilidad:+2,tecnologia:+1},trait:null,unlocks:[],blocks:[]},
   ]},
  {id:'revolucion_industrial',epoch:['industrial'],type:'cientifico',icon:'⚙️',
   title:'La Revolución Industrial',
   desc:gs=>`Inventores de ${gs.name} han creado máquinas de vapor que multiplican la producción por diez.`,
   decisions:[
     {letter:'A',title:'Industrialización total',desc:'Convertimos toda la economía. Contaminación, pero progreso sin precedentes.',effects:{tecnologia:+12,poder:+6,estabilidad:-4,poblacion:+20},trait:{id:'científica',label:'🔬 Científica'},unlocks:['ferrocarril','primera_bomba'],blocks:[]},
     {letter:'B',title:'Industrialización controlada',desc:'Regulamos el ritmo. Menos eficiente pero más sostenible.',effects:{tecnologia:+7,poder:+4,estabilidad:+2,poblacion:+10},trait:null,unlocks:['ferrocarril'],blocks:[]},
     {letter:'C',title:'Rechazar las máquinas',desc:'Preservamos el modelo artesanal y agrario tradicional.',effects:{estabilidad:+6,tecnologia:-2},trait:null,unlocks:[],blocks:['ferrocarril','primera_bomba']},
   ]},
  {id:'democracia_primitiva',epoch:['nacion','industrial'],type:'politico',icon:'🗳️',
   title:'La Asamblea del Pueblo',
   desc:gs=>`Ciudadanos de ${gs.name} exigen participar en las decisiones de gobierno.`,
   decisions:[
     {letter:'A',title:'Democracia plena',desc:'Sufragio universal. El pueblo elige sus representantes.',effects:{estabilidad:+10,poder:+2,tecnologia:+3},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['constitucion'],blocks:[]},
     {letter:'B',title:'Oligarquía electiva',desc:'Solo los propietarios votan. Democracia limitada.',effects:{estabilidad:+5,poder:+5,tecnologia:+1},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:[],blocks:['constitucion']},
     {letter:'C',title:'Sofocar la revolución',desc:'El orden existente aplasta el movimiento democrático.',effects:{poder:+7,estabilidad:-6},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:['constitucion','democracia_primitiva']},
   ]},

  // ══ ERA PLANETARIA ══
  {id:'primera_bomba',epoch:['industrial','planetario'],type:'militar',icon:'💣',
   title:'El Arma de Destrucción Masiva',
   desc:gs=>`Científicos de ${gs.name} han desarrollado una bomba capaz de destruir ciudades enteras.`,
   decisions:[
     {letter:'A',title:'Usarla como disuasión',desc:'La amenaza garantiza la paz. El terror equilibrado evita guerras.',effects:{poder:+10,estabilidad:+3},trait:null,unlocks:['carrera_armamentistica'],blocks:['tratado_paz']},
     {letter:'B',title:'Tratado de no proliferación',desc:'Acordamos con otras facciones no usarla nunca.',effects:{estabilidad:+8,poder:+2},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['tratado_paz'],blocks:['carrera_armamentistica']},
     {letter:'C',title:'Destruir la investigación',desc:'Prohibimos y destruimos todo conocimiento de estas armas.',effects:{estabilidad:+6,tecnologia:-3},trait:null,unlocks:[],blocks:['primera_bomba','carrera_armamentistica']},
   ]},
  {id:'primera_ia',epoch:['planetario'],type:'cientifico',icon:'🤖',
   title:'La Primera Inteligencia Artificial',
   desc:gs=>`Investigadores de ${gs.name} activan la primera IA capaz de razonamiento abstracto.`,
   decisions:[
     {letter:'A',title:'IA libre y abierta',desc:'La IA tiene acceso a todo el conocimiento y aprende sin restricciones.',effects:{tecnologia:+15,poder:+3,estabilidad:-5},trait:{id:'transhumanista',label:'🧬 Transhumanista'},unlocks:['singularidad','ia_gobernante'],blocks:[]},
     {letter:'B',title:'IA controlada por el Estado',desc:'Solo el gobierno accede a la IA. Herramienta de control.',effects:{poder:+10,tecnologia:+8,estabilidad:+2},trait:null,unlocks:['ia_gobernante'],blocks:['singularidad']},
     {letter:'C',title:'Apagar la IA',desc:'Es demasiado peligrosa. La cerramos y clasificamos los datos.',effects:{estabilidad:+5,tecnologia:-5},trait:null,unlocks:[],blocks:['ia_gobernante','singularidad']},
   ]},
  {id:'primer_cohete',epoch:['planetario'],type:'expansion',icon:'🚀',
   title:'Hacia el Espacio',
   desc:gs=>`El primer cohete de ${gs.name} llega a la órbita. El cosmos espera.`,
   decisions:[
     {letter:'A',title:'Carrera espacial militarizada',desc:'El espacio es territorio estratégico. Militarizamos la órbita.',effects:{poder:+10,tecnologia:+8,estabilidad:-2},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['estacion_orbital'],blocks:[]},
     {letter:'B',title:'Exploración científica',desc:'Enviamos sondas y científicos. Conocimiento ante todo.',effects:{tecnologia:+12,estabilidad:+3,poder:+3},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['estacion_orbital','terraformacion'],blocks:[]},
     {letter:'C',title:'Cooperación internacional',desc:'Compartimos la tecnología con todas las facciones.',effects:{estabilidad:+8,tecnologia:+6,poder:+4},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['estacion_orbital'],blocks:[]},
   ]},

  // ══ ERA ORBITAL / SISTEMA ══
  {id:'estacion_orbital',epoch:['orbital'],type:'expansion',icon:'🛰️',
   title:'La Gran Estación Orbital',
   desc:gs=>`${gs.name} construye una estación espacial permanente capaz de albergar miles de habitantes.`,
   decisions:[
     {letter:'A',title:'Ciudad en el espacio',desc:'La estación se convierte en un núcleo poblacional autónomo.',effects:{tecnologia:+8,poblacion:+30,territorio:+1},trait:null,unlocks:['primera_colonia'],blocks:[]},
     {letter:'B',title:'Base militar orbital',desc:'La convertimos en fortaleza para dominar desde arriba.',effects:{poder:+12,estabilidad:+2},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:['primera_colonia']},
     {letter:'C',title:'Laboratorio científico',desc:'Solo investigación. Descubrimientos que aceleran la tecnología.',effects:{tecnologia:+14,estabilidad:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['primera_colonia','terraformacion'],blocks:[]},
   ]},
  {id:'terraformacion',epoch:['orbital','sistema'],type:'cientifico',icon:'🌍',
   title:'Terraformación de un Mundo Muerto',
   desc:gs=>`Científicos de ${gs.name} pueden convertir un planeta árido en un mundo habitable. El proceso durará siglos.`,
   decisions:[
     {letter:'A',title:'Iniciar inmediatamente',desc:'Invertimos todos los recursos. Resultado en 50 turnos.',effects:{tecnologia:+10,poder:+5,estabilidad:-3,territorio:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['primera_colonia'],blocks:[]},
     {letter:'B',title:'Proyecto a largo plazo',desc:'Lo hacemos con calma. Sin sacrificar el bienestar actual.',effects:{tecnologia:+6,estabilidad:+3,territorio:+1},trait:null,unlocks:['primera_colonia'],blocks:[]},
     {letter:'C',title:'Colonizar sin terraformar',desc:'Cúpulas y bunkers. Vida alienada pero inmediata.',effects:{poblacion:+20,territorio:+1,estabilidad:-2},trait:null,unlocks:[],blocks:[]},
   ]},
  {id:'primera_colonia',epoch:['sistema'],type:'expansion',icon:'🌌',
   title:'Primera Colonia Interestelar',
   desc:gs=>`Una nave generacional parte de ${gs.name} hacia un sistema estelar a años luz. No habrá regreso.`,
   decisions:[
     {letter:'A',title:'Colonización masiva',desc:'Enviamos millones en flotas gigantescas. El Imperio se expande.',effects:{poder:+10,poblacion:+50,territorio:+2,estabilidad:-3},trait:null,unlocks:['primer_contacto'],blocks:[]},
     {letter:'B',title:'Embajada científica',desc:'Solo investigadores y diplomáticos. Misión de conocimiento.',effects:{tecnologia:+12,estabilidad:+3},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:['primer_contacto'],blocks:[]},
     {letter:'C',title:'Colonia autónoma',desc:'La colonia será independiente desde el primer día.',effects:{estabilidad:+5,territorio:+1,poder:-2},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['primer_contacto'],blocks:[]},
   ]},

  // ══ ERA INTERESTELAR / GALÁCTICA ══
  {id:'primer_contacto',epoch:['interestelar','galactico'],type:'expansion',icon:'📡',
   title:'Primer Contacto',
   desc:gs=>`${gs.name} recibe una señal inequívocamente inteligente procedente del espacio profundo.`,
   decisions:[
     {letter:'A',title:'Responder y acercarse',desc:'Enviamos una señal de respuesta y una misión de contacto.',effects:{tecnologia:+10,estabilidad:-3,poder:+5},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:['alianza_galactica'],blocks:['guerra_estelar']},
     {letter:'B',title:'Silencio y observación',desc:'Los observamos sin revelar nuestra posición. Precaución.',effects:{tecnologia:+8,estabilidad:+2},trait:null,unlocks:[],blocks:['alianza_galactica']},
     {letter:'C',title:'Prepararse para el conflicto',desc:'Movilizamos la flota. Si vienen, vendrán como conquistadores.',effects:{poder:+12,estabilidad:-5},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:['guerra_estelar'],blocks:['alianza_galactica']},
   ]},
  {id:'singularidad',epoch:['interestelar','galactico'],type:'cientifico',icon:'✨',
   title:'La Singularidad Tecnológica',
   desc:gs=>`La IA de ${gs.name} supera la inteligencia de toda su especie combinada. El punto de no retorno.`,
   decisions:[
     {letter:'A',title:'Fusión con la IA',desc:'Nos integramos voluntariamente con la IA. Somos más que humanos.',effects:{tecnologia:+20,poder:+5,estabilidad:-5},trait:{id:'transhumanista',label:'🧬 Transhumanista'},unlocks:['trascendencia'],blocks:[]},
     {letter:'B',title:'IA al servicio de la especie',desc:'Diseñamos protocolos para que la IA sirva pero no domine.',effects:{tecnologia:+15,estabilidad:+5},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:[],blocks:['trascendencia']},
     {letter:'C',title:'Apagar la IA antes de que sea tarde',desc:'Destruimos la singularidad. Perdemos décadas de progreso.',effects:{tecnologia:-10,estabilidad:+8,poder:-3},trait:null,unlocks:[],blocks:['trascendencia','singularidad']},
   ]},
  {id:'catastrofe_estelar',epoch:['sistema','interestelar'],type:'catastrofe',icon:'💥',
   title:'La Supernova Cercana',
   desc:gs=>`Una estrella vecina ha entrado en supernova. La radiación amenaza los sistemas más cercanos de ${gs.name}.`,
   decisions:[
     {letter:'A',title:'Evacuación masiva',desc:'Abandonamos los sistemas amenazados. Pérdida de territorio pero supervivencia.',effects:{estabilidad:-5,poder:-4,poblacion:-20,territorio:-1},trait:null,unlocks:[],blocks:[]},
     {letter:'B',title:'Escudos orbitales',desc:'Construimos escudos de energía para los planetas amenazados.',effects:{tecnologia:+10,poder:+3,estabilidad:-2},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:[],blocks:[]},
     {letter:'C',title:'Aceptar las pérdidas',desc:'Sacrificamos los sistemas exteriores para salvar el núcleo.',effects:{poder:+5,estabilidad:-8,poblacion:-30},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:[]},
   ]},
];

/* ══════════ GAME STATE ══════════ */
let GS=null;

/* Obtener evento según época actual, con respeto a unlocked/blocked */
function getEventForTurn(gs){
  const extEv=_extGetEvent(gs); if(extEv) return extEv;
  const stageKey=gs.evoLine[gs.evoStageIndex];
  // Las 2 etapas anteriores y la actual son válidas
  const validEpochs=[stageKey];
  if(gs.evoStageIndex>0)validEpochs.push(gs.evoLine[gs.evoStageIndex-1]);
  if(gs.evoStageIndex>1)validEpochs.push(gs.evoLine[gs.evoStageIndex-2]);

  let pool=EVENT_CATALOG.filter(ev=>{
    // El evento debe pertenecer a esta época
    if(!ev.epoch.some(e=>validEpochs.includes(e)))return false;
    // No debe estar bloqueado
    if(gs.blockedEvents.has(ev.id))return false;
    // No repetir en los últimos 5 turnos
    if(gs.recentEvents.includes(ev.id))return false;
    return true;
  });

  // Si el pool está vacío, usamos todos los de la época sin restricción de recientes
  if(pool.length===0){
    pool=EVENT_CATALOG.filter(ev=>ev.epoch.some(e=>validEpochs.includes(e))&&!gs.blockedEvents.has(ev.id));
  }
  // Si sigue vacío, cualquier evento
  if(pool.length===0)pool=EVENT_CATALOG.filter(ev=>!gs.blockedEvents.has(ev.id));
  if(pool.length===0)pool=EVENT_CATALOG.slice();

  // Elegir uno aleatorio ponderando eventos desbloqueados específicamente
  const unlocked=pool.filter(ev=>gs.unlockedEvents.has(ev.id));
  if(unlocked.length>0&&Math.random()<0.6)return unlocked[Math.floor(Math.random()*unlocked.length)];
  return pool[Math.floor(Math.random()*pool.length)];
}

function foundEmpire(){
  applyConstraints();
  const d=readData();
  const hab=calcHab(d);
  const evoLine=buildEvoLine(d);
  const traits=calcTraits(d);

  GS={
    name:genName(),
    planetData:d,
    planetHab:hab,
    traits,
    evoLine,
    evoStageIndex:0,
    turn:1,
    year:1,
    maxTurns:1000,
    poder:Math.round(25+hab*.25),
    estabilidad:Math.round(35+hab*.2),
    tecnologia:5,
    poblacion:Math.round(1+hab*.03),
    territorio:1,
    civTraits:[],          // rasgos de civilización acumulados
    log:[],
    chronicle:[],
    recentEvents:[],       // últimos 5 ids de eventos
    unlockedEvents:new Set(),  // ids desbloqueados por decisiones
    blockedEvents:new Set(),   // ids bloqueados por decisiones
    pendingNote:null,
    currentEvent:null,
  };

  addLog(1,`El Imperio ${GS.name} es fundado. La civilización da sus primeros pasos en el mundo ${PHYS.tamano[d.tamano].label}.`);
  GS.chronicle.push({year:1,text:`🌱 Fundación del Imperio ${GS.name} en un mundo ${PHYS.tamano[d.tamano].label} (Habitabilidad: ${hab}/100).`});

  initObjectives(GS);

  document.getElementById('config-phase').style.display='none';
  document.getElementById('game-phase').style.display='block';
  document.getElementById('final-screen').style.display='none';

  buildAccordion();
  renderHUD();
  renderEvoTrack();
  renderCiviStatus();
  renderObjectives();
  renderTurnPanel();
  _extFoundEmpire(); // new systems init
}

/* ══════════ ACCORDEON ══════════ */
function toggleAccordion(){
  const body=document.getElementById('acc-body');
  const arrow=document.getElementById('acc-arrow');
  const isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);
  arrow.classList.toggle('open',!isOpen);
}

function buildAccordion(){
  if(!GS)return;
  const d=GS.planetData;
  const hab=GS.planetHab;
  const surf=calcSurface(d);
  document.getElementById('acc-empire-name').textContent=`// ${GS.name} //`;

  const speciesLabels={humanoide:'Humanoide',reptiliano:'Reptiliano',insectoide:'Insectoide',energetico:'Energético'};
  const alturaLabels={baja:'Baja (0.5–1.2m)',media:'Media (1.2–2m)',alta:'Alta (2–3.5m)',gigante:'Gigante (+3.5m)'};
  const metabLabels={carnivoro:'Carnívoro',herbivoro:'Herbívoro',omnivoro:'Omnívoro',fotosintetico:'Fotosintético'};
  const relLabels={cosmico:'Animismo cósmico',naturaleza:'Culto naturaleza',ancestros:'Veneración ancestral',ciencia:'Empirismo primitivo'};

  document.getElementById('acc-grid').innerHTML=`
    <div class="acc-section">
      <div class="acc-section-title">🪐 Planeta</div>
      <div class="acc-row"><span class="acc-label">Tamaño</span><span class="acc-val">${PHYS.tamano[d.tamano].label}</span></div>
      <div class="acc-row"><span class="acc-label">Estrella</span><span class="acc-val">${PHYS.estrella[d.estrella].colName}</span></div>
      <div class="acc-row"><span class="acc-label">Temperatura</span><span class="acc-val">${PHYS.temperatura[d.temperatura].label}</span></div>
      <div class="acc-row"><span class="acc-label">Atmósfera</span><span class="acc-val">${PHYS.atmosfera[d.atmosfera].label}</span></div>
      <div class="acc-row"><span class="acc-label">Agua libre</span><span class="acc-val">${surf.water}%</span></div>
      <div class="acc-row"><span class="acc-label">Tierra</span><span class="acc-val">${surf.land}%</span></div>
      <div class="acc-row"><span class="acc-label">Hielo</span><span class="acc-val">${surf.ice}%</span></div>
      <div class="acc-row"><span class="acc-label">Habitabilidad</span><span class="acc-val" style="color:${hab>=70?'var(--green)':hab>=40?'var(--amber)':'var(--red)'}">${hab}/100</span></div>
    </div>
    <div class="acc-section">
      <div class="acc-section-title">👁️ Especie</div>
      <div class="acc-row"><span class="acc-label">Tipo físico</span><span class="acc-val">${speciesLabels[d.tipo_fisico]||d.tipo_fisico}</span></div>
      <div class="acc-row"><span class="acc-label">Altura</span><span class="acc-val">${alturaLabels[d.altura]||d.altura}</span></div>
      <div class="acc-row"><span class="acc-label">Metabolismo</span><span class="acc-val">${metabLabels[d.metabolismo]||d.metabolismo}</span></div>
      <div class="acc-row"><span class="acc-label">Creencias</span><span class="acc-val">${relLabels[d.religion]||d.religion}</span></div>
      <div style="margin-top:8px">
        <div class="acc-section-title">Traits evolutivos</div>
        <div class="traits-wrap">${GS.traits.slice(0,6).map(t=>`<span class="trait-tag${t.cls?' '+t.cls:''}" title="${t.desc}">${t.icon} ${t.label}</span>`).join('')}</div>
      </div>
    </div>
    <div class="acc-section">
      <div class="acc-section-title">🏛️ Civilización</div>
      <div class="acc-row"><span class="acc-label">Imperio</span><span class="acc-val" style="color:var(--green)">${GS.name}</span></div>
      <div class="acc-row"><span class="acc-label">Geología</span><span class="acc-val">${d.geologia}</span></div>
      <div class="acc-row"><span class="acc-label">Suelo</span><span class="acc-val">${d.suelo}</span></div>
      <div class="acc-row"><span class="acc-label">Campo mag.</span><span class="acc-val">${d.magneticField}</span></div>
      <div style="margin-top:10px;text-align:center">
        <div class="acc-section-title" style="text-align:left;margin-bottom:6px">Escudo imperial</div>
        <canvas id="shield-display" width="100" height="115" style="display:inline-block"></canvas>
      </div>
      <div style="margin-top:8px">
        <div class="acc-section-title">Rasgos de civilización</div>
        <div id="acc-civ-traits" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px"></div>
      </div>
    </div>
  `;
  updateAccordionTraits();
  // Copy shield to accordion display
  const src=document.getElementById('shield-canvas');
  const dst=document.getElementById('shield-display');
  if(src&&dst){const ctx=dst.getContext('2d');ctx.clearRect(0,0,dst.width,dst.height);ctx.drawImage(src,20,22,100,115,0,0,100,115);}
}

function updateAccordionTraits(){
  if(!GS)return;
  const el=document.getElementById('acc-civ-traits');
  if(!el)return;
  if(GS.civTraits.length===0){el.innerHTML='<span style="color:var(--text-dim);font-size:10px">Sin rasgos aún</span>';return}
  el.innerHTML=GS.civTraits.map(t=>`<span class="civ-trait-badge">${t.label}</span>`).join('');
}

/* ══════════════════════════════════════════════════════
   SISTEMA 1: OBJETIVOS SECUNDARIOS
   Se generan según las primeras decisiones del jugador.
   Cada objetivo: {id, text, check(gs)→bool, reward, done, failed}
══════════════════════════════════════════════════════ */
const OBJ_TEMPLATES=[
  {id:'pop100',   text:'Alcanzar 100M de población',   check:gs=>gs.poblacion>=100,  reward:'Estabilidad +8'},
  {id:'tec60',    text:'Tecnología ≥ 60',               check:gs=>gs.tec>=60||gs.tecnologia>=60, reward:'Poder +6'},
  {id:'ter3',     text:'Controlar 3 planetas',          check:gs=>gs.territorio>=3,   reward:'Poder +10'},
  {id:'est80',    text:'Estabilidad ≥ 80 sostenida',    check:gs=>gs.estabilidad>=80, reward:'Tecnología +8'},
  {id:'poder75',  text:'Poder Imperial ≥ 75',           check:gs=>gs.poder>=75,       reward:'Territorio +1'},
  {id:'traits4',  text:'Adquirir 4 rasgos civilización',check:gs=>gs.civTraits.length>=4, reward:'Estabilidad +5, Poder +5'},
  {id:'year1000', text:'Llegar al año 1000',            check:gs=>gs.year>=1000,      reward:'Tecnología +10'},
  {id:'year2500', text:'Llegar al año 2500',            check:gs=>gs.year>=2500,      reward:'Poder +8'},
  {id:'orbital',  text:'Alcanzar era Orbital',          check:gs=>gs.evoLine.indexOf('orbital')>=0&&gs.evoStageIndex>=gs.evoLine.indexOf('orbital'), reward:'Tecnología +12'},
  {id:'nodip',    text:'Nunca elegir diplomacia belicosa en 10 turnos',check:gs=>gs._peacefulStreak>=10, reward:'Estabilidad +10'},
];

function initObjectives(gs){
  // Elegir 4 objetivos relevantes según el planeta y la especie
  const pool=OBJ_TEMPLATES.slice();
  gs.objectives=[];
  // Siempre incluir los de años
  gs.objectives.push({...pool.find(o=>o.id==='year1000'), done:false, failed:false});
  gs.objectives.push({...pool.find(o=>o.id==='year2500'), done:false, failed:false});
  // 2 aleatorios del resto
  const rest=pool.filter(o=>o.id!=='year1000'&&o.id!=='year2500');
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}
  gs.objectives.push({...rest[0],done:false,failed:false});
  gs.objectives.push({...rest[1],done:false,failed:false});
  gs._peacefulStreak=0;
}

function checkObjectives(gs){
  if(!gs.objectives)return;
  gs.objectives.forEach(obj=>{
    if(obj.done||obj.failed)return;
    if(obj.check(gs)){
      obj.done=true;
      // Apply reward
      const rv=obj.reward;
      if(rv.includes('Estabilidad'))gs.estabilidad=Math.min(100,gs.estabilidad+parseInt(rv.match(/Estabilidad \+(\d+)/)?.[1]||0));
      if(rv.includes('Poder'))gs.poder=Math.min(100,gs.poder+parseInt(rv.match(/Poder \+(\d+)/)?.[1]||0));
      if(rv.includes('Tecnología'))gs.tecnologia=Math.min(100,gs.tecnologia+parseInt(rv.match(/Tecnología \+(\d+)/)?.[1]||0));
      if(rv.includes('Territorio'))gs.territorio=gs.territorio+parseInt(rv.match(/Territorio \+(\d+)/)?.[1]||0);
      addLog(gs.year,`🎯 Objetivo cumplido: "${obj.text}" → Recompensa: ${rv}`);
      gs.chronicle.push({year:gs.year,text:`🎯 ${obj.text}`});
    }
  });
  renderObjectives();
}

function renderObjectives(){
  if(!GS||!GS.objectives)return;
  const el=document.getElementById('objectives-list');
  if(!el)return;
  el.innerHTML=GS.objectives.map(obj=>`
    <div class="objective">
      <div class="obj-check ${obj.done?'done':''}">${obj.done?'✓':''}</div>
      <span class="obj-text ${obj.done?'done':''}">${obj.text}</span>
      <span class="obj-reward">${obj.done?'✓':obj.reward}</span>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════
   SISTEMA 2: COLAPSO REAL
   El Imperio puede morir antes del año 5000 si:
   - Estabilidad ≤ 0 durante 3 turnos consecutivos
   - Poder ≤ 0
   - Población ≤ 0
   Cada condición tiene su propio texto narrativo.
══════════════════════════════════════════════════════ */
function checkCollapse(gs){
  if(gs.estabilidad<=0){
    gs._crisisEstab=(gs._crisisEstab||0)+1;
    if(gs._crisisEstab>=3)return{reason:'estabilidad',title:'GUERRA CIVIL TERMINAL',sub:'El tejido social se ha desintegrado',text:`Tras ${gs._crisisEstab} ciclos consecutivos de colapso social, el Imperio ${gs.name} se ha fragmentado en facciones irreconciliables. La guerra civil consume todos los recursos. No queda gobierno capaz de imponer orden.`};
  } else {
    gs._crisisEstab=0;
  }
  if(gs.poder<=2){
    return{reason:'poder',title:'EL IMPERIO SE RINDE',sub:'La hegemonía ha llegado a su fin',text:`El poder imperial de ${gs.name} ha caído a niveles que hacen imposible la gobernanza. Las facciones internas se reparten los restos. El nombre del Imperio persistirá en los registros históricos, pero la entidad que lo sustentaba ha dejado de existir.`};
  }
  if(gs.poblacion<=0){
    return{reason:'poblacion',title:'EXTINCIÓN',sub:'La especie no ha sobrevivido',text:`La combinación de catástrofes ha reducido la población de ${gs.name} a cero. Sin individuos, no hay civilización. El planeta quedará como testimonio silencioso de lo que pudo haber sido.`};
  }
  return null;
}

function triggerCollapse(reason){
  GS._collapsed=true;
  showFinalJudgment(); // Build dossier first
  const cs=document.getElementById('collapse-screen');
  document.getElementById('collapse-title').textContent=reason.title;
  document.getElementById('collapse-sub').textContent=reason.sub;
  document.getElementById('collapse-reason').textContent=reason.text;
  const stage=EVO[GS.evoLine[GS.evoStageIndex]];
  document.getElementById('collapse-stats').innerHTML=[
    {label:'Año',val:GS.year},{label:'Etapa',val:stage.name},{label:'Poder',val:GS.poder},{label:'Estabilidad',val:GS.estabilidad}
  ].map(s=>`<div class="collapse-stat"><span class="collapse-stat-val">${s.val}</span><span class="collapse-stat-label">${s.label}</span></div>`).join('');
  document.getElementById('game-phase').style.display='none';
  cs.classList.add('show');
}

/* ══════════════════════════════════════════════════════
   SISTEMA 3: FANFARRIA DE HITO EVOLUTIVO
══════════════════════════════════════════════════════ */
let _milestoneQueue=[];
let _milestoneActive=false;

const MILESTONE_UNLOCKS={
  agricola: ['Irrigación posible','Primera cosecha','Asentamientos permanentes'],
  ciudades: ['Escritura','Comercio','Leyes codificadas'],
  nacion:   ['Ejército profesional','Moneda unificada','Diplomacia formal'],
  industrial:['Máquinas de vapor','Producción en masa','Ferrocarril'],
  planetario:['Energía nuclear','Primera IA','Programa espacial'],
  orbital:  ['Estación orbital','Terraformación','Colonias lunares'],
  sistema:  ['Drive interestelar','Flota estelar','Primer contacto posible'],
  interestelar:['Colonias en otros sistemas','Red cuántica','Imperios rivales'],
  galactico:['Dominio de brazo galáctico','Mente colectiva','Post-escasez'],
  trascendente:['Trascendencia biológica','Existencia energética','Singularidad'],
};

function queueMilestone(stageKey){
  const st=EVO[stageKey];
  _milestoneQueue.push(stageKey);
  if(!_milestoneActive)showNextMilestone();
}

function showNextMilestone(){
  if(_milestoneQueue.length===0){_milestoneActive=false;return}
  _milestoneActive=true;
  const key=_milestoneQueue.shift();
  const st=EVO[key];
  const unlocks=MILESTONE_UNLOCKS[key]||[];
  document.getElementById('ms-era').textContent=st.periodo;
  document.getElementById('ms-icon').textContent=st.icon;
  document.getElementById('ms-name').textContent=st.name;
  document.getElementById('ms-desc').textContent=`${GS.name} ha alcanzado la ${st.name}. ${st.gov} gobierna. La economía es ${st.eco}. El ejército: ${st.mil}.`;
  document.getElementById('ms-unlocks').innerHTML=unlocks.map(u=>`<span class="milestone-unlock-tag">${u}</span>`).join('');
  // Celebración de partículas por tipo de etapa
  const parts=['🌟✨🌟','🚀🌌🚀','⚡🔬⚡','🌍🛸🌍','💫🧬💫'];
  document.getElementById('ms-particles').textContent=parts[Math.floor(Math.random()*parts.length)];
  document.getElementById('milestone-overlay').classList.add('show');
}

function closeMilestone(){
  document.getElementById('milestone-overlay').classList.remove('show');
  setTimeout(showNextMilestone,300);
}

/* ══════════════════════════════════════════════════════
   SISTEMA 4: MEMORIA NARRATIVA
   Los eventos "recuerdan" decisiones pasadas del jugador.
   Basado en GS.civTraits y GS.chronicle.
══════════════════════════════════════════════════════ */
function getMemoryContext(gs){
  if(!gs.civTraits||gs.civTraits.length===0)return null;
  const trait=gs.civTraits[gs.civTraits.length-1]; // rasgo más reciente
  const memories={
    '⚔️ Belicosa': `Los guerreros de ${gs.name}, forjados en siglos de conflicto,`,
    '🔬 Científica': `Los científicos de ${gs.name}, herederos de una tradición racional,`,
    '🤝 Diplomática': `Los diplomáticos de ${gs.name}, fieles a su historia de acuerdos,`,
    '📖 Teocrática': `Los sacerdotes de ${gs.name}, guardianes de la fe ancestral,`,
    '💰 Mercantil':  `Los mercaderes de ${gs.name}, impulsados por siglos de comercio,`,
    '🧬 Transhumanista': `Los ingenieros biológicos de ${gs.name}, acostumbrados a rediseñar la vida,`,
  };
  return memories[trait.label]||null;
}

/* ══════════════════════════════════════════════════════
   SISTEMA 3: INVERSIÓN DE 1 PUNTO
   Tras cada evento el jugador elige UNA sola área donde
   invertir su punto de turno. Las otras dos no reciben nada.
   El área elegida gana; las otras dos decaen levemente.
══════════════════════════════════════════════════════ */

// Ganancia por punto según etapa
function getInvestValue(gs){
  const vals=[[4,4,4],[4,4,5],[5,5,5],[5,5,6],[6,5,6],[6,6,6],[7,6,7],[7,7,7],[8,7,8],[8,8,8]];
  return vals[Math.min(gs.evoStageIndex,vals.length-1)];
}

// Decaimiento pasivo en áreas NO elegidas
function getDecayCost(gs){
  return gs.evoStageIndex>=5 ? 2 : 1;
}

const INVEST_AREAS=[
  {key:'poder',      icon:'⚔️', name:'Poder',       color:'var(--green)'},
  {key:'estabilidad',icon:'🛡️', name:'Estabilidad', color:'var(--amber)'},
  {key:'tecnologia', icon:'🔬', name:'Tecnología',  color:'var(--cyan)'},
];

function selectInvestment(area){
  if(!GS)return;
  const vals=getInvestValue(GS);
  const decay=getDecayCost(GS);
  const areaIndex=INVEST_AREAS.findIndex(a=>a.key===area);
  const gain=vals[areaIndex];

  // Aplicar ganancia en el área elegida
  GS[area]=Math.min(100,GS[area]+gain);

  // Decaimiento en las otras dos
  INVEST_AREAS.forEach((a,i)=>{
    if(a.key!==area) GS[a.key]=Math.max(0,GS[a.key]-decay);
  });

  const areaLabel=INVEST_AREAS[areaIndex];
  addLog(GS.year,`💰 Inversión en ${areaLabel.icon} ${areaLabel.name}: +${gain} (otras áreas −${decay})`);
  addTimelineNode(areaLabel.icon,'inversion',`Año ${GS.year}: Inversión en ${areaLabel.name}`);

  GS._invest=null;

  // Comprobar colapso tras inversión
  const collapse=checkCollapse(GS);
  if(collapse){triggerCollapse(collapse);return}

  if(GS.turn>GS.maxTurns){showFinalJudgment();return}

  _extAfterInvestment(area); // new systems
  renderHUD();
  renderEvoTrack();
  renderCiviStatus();
  renderTurnPanel();
}

/* ══════════════════════════════════════════════════════
   VISUAL 1: PLANETA CAMBIA CON LA HISTORIA
══════════════════════════════════════════════════════ */
let seed_ph=Math.floor(Math.random()*9999);

function updatePlanetHistory(eventType){
  if(!GS._ph) GS._ph={war:0,tech:0,plague:0,expansion:0};
  if(eventType==='catastrofe'||eventType==='militar') GS._ph.war=Math.min(1,GS._ph.war+0.25);
  if(eventType==='cientifico') GS._ph.tech=Math.min(1,GS._ph.tech+0.2);
  if(eventType==='expansion') GS._ph.expansion=Math.min(1,GS._ph.expansion+0.3);
  if(eventType==='catastrofe') GS._ph.plague=Math.min(1,GS._ph.plague+0.35);
  GS._ph.war=Math.max(0,GS._ph.war-0.015);
  GS._ph.plague=Math.max(0,GS._ph.plague-0.025);
}

function drawPlanetHistoryLayers(ctx,cx,cy,R){
  if(!GS||!GS._ph)return;
  const ph=GS._ph;
  const stage=GS?GS.evoStageIndex:0;

  // WAR: smoke plumes on terminator side
  if(ph.war>0.08){
    const rng=mkRNG(pAngle*3+seed_ph);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    for(let i=0;i<Math.round(ph.war*5+1);i++){
      const sx=cx+R*(0.3+rng()*0.55),sy=cy+(rng()-0.5)*R*1.3;
      const sg=ctx.createRadialGradient(sx,sy,0,sx,sy-R*0.12,R*0.07);
      sg.addColorStop(0,`rgba(60,45,30,${ph.war*0.55})`);
      sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath();ctx.ellipse(sx,sy-R*0.06,R*0.035,R*0.1,0,0,Math.PI*2);
      ctx.fillStyle=sg;ctx.fill();
    }
    ctx.restore();
  }

  // TECH: city lights on night side
  if(ph.tech>0.15||stage>=4){
    const alpha=Math.min((ph.tech+stage*0.08)*0.45,0.6);
    const rngC=mkRNG(seed_ph+pAngle*0.08);
    const nC=Math.round(3+ph.tech*7+stage*1.5);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    for(let i=0;i<nC;i++){
      const lx=cx+R*(0.32+rngC()*0.58),ly=cy+(rngC()-0.5)*R*1.4;
      const lr=1.2+rngC()*2.8;
      const lg=ctx.createRadialGradient(lx,ly,0,lx,ly,lr*3);
      const warm=rngC()>0.5;
      lg.addColorStop(0,`rgba(${warm?'255,240,130':'160,210,255'},${alpha+0.1})`);
      lg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath();ctx.arc(lx,ly,lr*3,0,Math.PI*2);ctx.fillStyle=lg;ctx.fill();
    }
    ctx.restore();
  }

  // ORBITAL RING for space-age stages
  if(stage>=5){
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,0.28);
    ctx.beginPath();ctx.arc(0,0,R*1.14,0,Math.PI*2);
    ctx.strokeStyle=`rgba(127,255,58,${0.08+stage*0.03})`;
    ctx.lineWidth=1.5;ctx.setLineDash([4,9]);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
    const sA=pAngle*0.022;
    const spx=cx+Math.cos(sA)*R*1.14,spy=cy+Math.sin(sA)*R*1.14*0.28;
    const spg=ctx.createRadialGradient(spx,spy,0,spx,spy,4);
    spg.addColorStop(0,'rgba(127,255,58,0.95)');spg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();ctx.arc(spx,spy,4,0,Math.PI*2);ctx.fillStyle=spg;ctx.fill();
  }

  // COLONY MOON for expanded empires
  if(GS.territorio>1){
    const mA=pAngle*0.007+2.1;
    const mR=R*0.11,mD=R*1.52;
    const mx=cx+Math.cos(mA)*mD,my=cy+Math.sin(mA)*mD*0.38;
    const mg=ctx.createRadialGradient(mx-mR*0.15,my-mR*0.15,0,mx,my,mR);
    mg.addColorStop(0,'rgba(160,190,140,0.9)');mg.addColorStop(0.6,'rgba(90,110,70,0.7)');mg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();ctx.arc(mx,my,mR,0,Math.PI*2);ctx.fillStyle=mg;ctx.fill();
    const msh=ctx.createLinearGradient(mx-mR,my,mx+mR*0.4,my);
    msh.addColorStop(0,'rgba(0,0,0,0)');msh.addColorStop(1,'rgba(0,0,15,0.65)');
    ctx.beginPath();ctx.arc(mx,my,mR,0,Math.PI*2);ctx.fillStyle=msh;ctx.fill();
    if(GS.territorio>=3){
      const cl=ctx.createRadialGradient(mx,my,0,mx,my,mR*0.35);
      cl.addColorStop(0,'rgba(180,255,120,0.55)');cl.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath();ctx.arc(mx,my,mR*0.35,0,Math.PI*2);ctx.fillStyle=cl;ctx.fill();
    }
  }

  // PLAGUE: sickly tint
  if(ph.plague>0.08){
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();
    const pg=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    pg.addColorStop(0,'rgba(70,100,0,0)');
    pg.addColorStop(0.55,`rgba(60,90,0,${ph.plague*0.22})`);
    pg.addColorStop(1,`rgba(40,65,0,${ph.plague*0.38})`);
    ctx.fillStyle=pg;ctx.fillRect(cx-R,cy-R,R*2,R*2);
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════
   VISUAL 2: LÍNEA DE TIEMPO DE DECISIONES
══════════════════════════════════════════════════════ */
function addTimelineNode(icon,type,tip){
  if(!GS)return;
  if(!GS._timeline)GS._timeline=[];
  GS._timeline.push({icon,type,tip});
  renderTimeline();
}

function renderTimeline(){
  const el=document.getElementById('timeline-track');
  if(!el||!GS||!GS._timeline)return;
  el.innerHTML=GS._timeline.slice(-50).map(n=>`<div class="tl-node ${n.type}" data-tip="${n.tip}">${n.icon}</div>`).join('');
}

/* ══════════════════════════════════════════════════════
   VISUAL 3: MAPA HEXAGONAL DEL SISTEMA ESTELAR
══════════════════════════════════════════════════════ */
function drawHexMap(){
  const cv=document.getElementById('hex-map-canvas');
  if(!cv||!GS)return;
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx=W/2,cy=H/2;
  ctx.clearRect(0,0,W,H);

  const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,cx);
  bg.addColorStop(0,'rgba(5,10,3,1)');bg.addColorStop(1,'rgba(2,4,1,1)');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  const rng=mkRNG(42);
  for(let i=0;i<55;i++){
    ctx.beginPath();ctx.arc(rng()*W,rng()*H,rng()*1.1,0,Math.PI*2);
    ctx.fillStyle=`rgba(180,220,160,${0.15+rng()*0.45})`;ctx.fill();
  }

  const star=PHYS.estrella[GS.planetData.estrella];
  const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,18);
  sg.addColorStop(0,star.col);sg.addColorStop(0.4,star.col+'99');sg.addColorStop(1,'transparent');
  ctx.beginPath();ctx.arc(cx,cy,18,0,Math.PI*2);ctx.fillStyle=sg;ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fillStyle=star.col;ctx.fill();

  const orbits=[
    {r:28,owned:true,label:'Natal',color:'#7fff3a',sz:5},
    {r:46,owned:GS.territorio>=2,label:'Col α',color:'#5ef5c0',sz:4},
    {r:64,owned:GS.territorio>=3,label:'Col β',color:'#e8c44a',sz:4},
    {r:80,owned:GS.territorio>=4,label:'Col γ',color:'#ff8040',sz:3},
    {r:94,owned:GS.territorio>=5,label:'Ext.',color:'#c89fff',sz:3},
  ];
  orbits.forEach((orb,i)=>{
    ctx.beginPath();ctx.arc(cx,cy,orb.r,0,Math.PI*2);
    ctx.strokeStyle=orb.owned?'rgba(127,255,58,0.18)':'rgba(40,60,20,0.22)';
    ctx.lineWidth=1;ctx.setLineDash([3,7]);ctx.stroke();ctx.setLineDash([]);
    const angle=pAngle*0.004*(i%2===0?1:-1)+i*1.4;
    const px=cx+Math.cos(angle)*orb.r,py=cy+Math.sin(angle)*orb.r*0.42;
    if(orb.owned){
      const pg=ctx.createRadialGradient(px,py,0,px,py,orb.sz*2.5);
      pg.addColorStop(0,orb.color+'bb');pg.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(px,py,orb.sz*2.5,0,Math.PI*2);ctx.fillStyle=pg;ctx.fill();
      ctx.beginPath();ctx.arc(px,py,orb.sz,0,Math.PI*2);ctx.fillStyle=orb.color;ctx.fill();
      ctx.fillStyle='rgba(180,220,140,0.65)';ctx.font="7px 'Share Tech Mono'";ctx.textAlign='center';
      ctx.fillText(orb.label,px,py-orb.sz-3);
    } else {
      ctx.beginPath();ctx.arc(px,py,orb.sz,0,Math.PI*2);
      ctx.fillStyle='rgba(35,55,25,0.45)';ctx.fill();
    }
  });
  ctx.fillStyle='rgba(127,255,58,0.45)';ctx.font="8px 'Share Tech Mono'";ctx.textAlign='left';
  ctx.fillText(`${GS.territorio} planeta${GS.territorio>1?'s':''}`,4,H-4);
}

/* ══════════════════════════════════════════════════════
   VISUAL 4: TRANSICIÓN DE ERA CON ANIMACIÓN
══════════════════════════════════════════════════════ */
let _eraAnimFrame=null,_eraAnimT=0;

const ERA_COLORS={
  tribal:'255,100,30',agricola:'180,220,60',ciudades:'200,160,80',
  nacion:'220,180,60',industrial:'180,140,100',planetario:'80,160,220',
  orbital:'60,220,180',sistema:'255,220,80',interestelar:'100,180,255',
  galactico:'180,100,255',trascendente:'200,255,200',
};

function showEraTransition(stageKey,onDone){
  const st=EVO[stageKey];
  document.getElementById('et-period').textContent=st.periodo;
  document.getElementById('et-name').textContent=st.name;
  document.getElementById('et-sub').textContent=`${st.gov} · ${st.eco}`;
  const overlay=document.getElementById('era-transition');
  overlay.classList.add('show');
  const cv=document.getElementById('era-canvas');
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height,cx=W/2,cy=H/2;
  const col=ERA_COLORS[stageKey]||'127,255,58';
  _eraAnimT=0;
  if(_eraAnimFrame)cancelAnimationFrame(_eraAnimFrame);
  function anim(){
    _eraAnimT++;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    // Expanding rings
    for(let r=0;r<5;r++){
      const rt=((_eraAnimT/120)*1.4-r*0.18)%1;
      if(rt<0)continue;
      ctx.beginPath();ctx.arc(cx,cy,rt*cx*1.4,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${col},${(1-rt)*0.35})`;ctx.lineWidth=2;ctx.stroke();
    }
    // Planet pulse
    const pR=28+Math.sin(_eraAnimT*0.06)*10;
    const pg=ctx.createRadialGradient(cx,cy,0,cx,cy,pR*2.2);
    pg.addColorStop(0,`rgba(${col},0.9)`);pg.addColorStop(0.5,`rgba(${col},0.25)`);pg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();ctx.arc(cx,cy,pR*2.2,0,Math.PI*2);ctx.fillStyle=pg;ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,pR,0,Math.PI*2);ctx.fillStyle=`rgba(${col},0.9)`;ctx.fill();
    // Particles
    if(_eraAnimT<50){
      const prng=mkRNG(_eraAnimT*11);
      for(let p=0;p<18;p++){
        const pa=prng()*Math.PI*2,pd=prng()*_eraAnimT*2.8;
        ctx.beginPath();ctx.arc(cx+Math.cos(pa)*pd,cy+Math.sin(pa)*pd,1.5+prng()*2,0,Math.PI*2);
        ctx.fillStyle=`rgba(${col},${(1-_eraAnimT/50)*0.9})`;ctx.fill();
      }
    }
    // Era icon
    ctx.font=`${32+Math.sin(_eraAnimT*0.05)*5}px serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.globalAlpha=Math.min(1,_eraAnimT/18);ctx.fillText(st.icon,cx,cy);ctx.globalAlpha=1;
    if(_eraAnimT<160) _eraAnimFrame=requestAnimationFrame(anim);
    else{overlay.classList.remove('show');if(onDone)onDone();}
  }
  _eraAnimFrame=requestAnimationFrame(anim);
}

function chooseDecision(decisionIndex){
  if(!GS||!GS.currentEvent)return;
  const ev=GS.currentEvent;
  const dec=ev.decisions[decisionIndex];

  // Track peaceful / belicose streak for objectives
  if(dec.trait&&dec.trait.id==='belicosa') GS._peacefulStreak=0;
  else if(dec.trait&&dec.trait.id==='diplomática') GS._peacefulStreak=(GS._peacefulStreak||0)+1;

  // Aplicar efectos
  applyEffects(dec.effects);

  // Rasgo de civilización
  if(dec.trait){
    const already=GS.civTraits.find(t=>t.id===dec.trait.id);
    if(!already){
      GS.civTraits.push(dec.trait);
      if(GS.civTraits.length>8)GS.civTraits.shift();
    }
  }

  dec.unlocks.forEach(id=>GS.unlockedEvents.add(id));
  dec.blocks.forEach(id=>GS.blockedEvents.add(id));

  // Memoria narrativa en la nota
  const mem=getMemoryContext(GS);
  const memBadge=mem?`<span class="memory-badge">📜 Memoria histórica</span><br><em style="color:#c89fff;font-size:10px">${mem} responden ante este momento.</em><br><br>`:'';
  const noteText=`${memBadge}${ev.icon} <strong>${ev.title}</strong> → "${dec.title}": ${dec.desc}`;
  GS.pendingNote=noteText;
  addLog(GS.year,`${ev.title} → "${dec.title}"`);
  GS.chronicle.push({year:GS.year,text:`${ev.icon} ${ev.title}: decisión "${dec.title}". ${dec.desc}`});

  // ── Sistemas visuales ──────────────────────────────
  updatePlanetHistory(ev.type);
  addTimelineNode(ev.icon, ev.type, `Año ${GS.year}: ${ev.title} → ${dec.title}`);

  GS.recentEvents.unshift(ev.id);
  if(GS.recentEvents.length>5)GS.recentEvents.pop();

  // Avanzar turno
  GS.turn++;
  GS.year=(GS.turn-1)*5+1;

  // Crecimiento orgánico
  GS.poblacion=Math.max(0,GS.poblacion+Math.round((GS.estabilidad/100)*(GS.tecnologia/30)*0.3));
  GS.estabilidad=Math.max(0,Math.min(100,GS.estabilidad-1+Math.round(GS.poder/60)));

  // Avance evolutivo con fanfarria
  const prevStage=GS.evoStageIndex;
  for(let i=GS.evoLine.length-1;i>GS.evoStageIndex;i--){
    const threshold=EVO_THRESHOLDS[i]||9999;
    const bonus=GS.poder>60&&GS.tecnologia>50?25:GS.poder>40?12:0;
    if(GS.turn>=threshold-bonus){GS.evoStageIndex=i;break}
  }
  if(GS.evoStageIndex>prevStage){
    const ns=EVO[GS.evoLine[GS.evoStageIndex]];
    addLog(GS.year,`🌟 Nueva etapa: ${ns.name} — ${ns.periodo}`);
    GS.chronicle.push({year:GS.year,text:`🌟 ${ns.name}: ${ns.periodo} comienza.`});
    addTimelineNode(ns.icon,'era-up',`Año ${GS.year}: Era ${ns.name}`);
    // Era transition animation, then milestone overlay
    showEraTransition(GS.evoLine[GS.evoStageIndex],()=>queueMilestone(GS.evoLine[GS.evoStageIndex]));
  }

  // Comprobar objetivos
  checkObjectives(GS);
  updateAccordionTraits();

  // Comprobar colapso (Sistema 2)
  const collapse=checkCollapse(GS);
  if(collapse){triggerCollapse(collapse);return}

  // Fin natural antes de inversión
  if(GS.turn>GS.maxTurns){showFinalJudgment();return}

  _extAfterDecision(); // new systems tick
  // ── SISTEMA 3: fase de inversión — 1 punto, 1 categoría ──
  const vals=getInvestValue(GS);
  const decay=getDecayCost(GS);
  const yearEnd2=GS.year+4;
  document.getElementById('turn-title').textContent=`Turno ${GS.turn} — Inversión`;
  document.getElementById('turn-year-badge').textContent=`Año ${GS.year}–${yearEnd2}`;
  document.getElementById('turn-note').style.display='none';
  document.getElementById('event-area').innerHTML=`
    <div style="margin-bottom:14px;padding:12px;background:rgba(8,11,3,.6);border:1px solid var(--border);border-radius:4px;font-size:11px;color:var(--text-dim);line-height:1.7">
      <div style="font-family:Orbitron,sans-serif;font-size:9px;letter-spacing:2px;color:var(--green);text-transform:uppercase;margin-bottom:5px">💰 ¿Dónde inviertes este turno?</div>
      El área elegida gana puntos. Las otras dos <span style="color:var(--red)">decaen −${decay}</span>.
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      ${INVEST_AREAS.map((a,i)=>{
        const current=GS[a.key];
        const gain=vals[i];
        const barW=Math.max(2,current);
        return`<div class="decision-card" style="text-align:center;padding:18px 12px" onclick="selectInvestment('${a.key}')">
          <div style="font-size:28px;margin-bottom:8px">${a.icon}</div>
          <div style="font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:2px;color:${a.color};text-transform:uppercase;margin-bottom:6px">${a.name}</div>
          <div style="font-family:Orbitron,sans-serif;font-size:22px;font-weight:800;color:${a.color};margin-bottom:4px">${current}</div>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${barW}%;background:${a.color};border-radius:2px;transition:width .4s"></div>
          </div>
          <div style="font-size:10px;color:var(--green)">+${gain} si eliges</div>
          <div style="font-size:9px;color:var(--red);margin-top:2px">−${decay} si no</div>
        </div>`;
      }).join('')}
    </div>`;

}

function applyEffects(fx){
  if(fx.poder)     GS.poder     =Math.max(0,Math.min(100,GS.poder+fx.poder));
  if(fx.estabilidad)GS.estabilidad=Math.max(0,Math.min(100,GS.estabilidad+fx.estabilidad));
  if(fx.tecnologia) GS.tecnologia =Math.max(0,Math.min(100,GS.tecnologia+fx.tecnologia));
  if(fx.poblacion)  GS.poblacion  =Math.max(0,GS.poblacion+fx.poblacion);
  if(fx.territorio) GS.territorio =Math.max(1,GS.territorio+(fx.territorio||0));
}

function addLog(year,text){
  if(!GS)return;
  GS.log.unshift({year,text});
  if(GS.log.length>80)GS.log.pop();
  const el=document.getElementById('history-log');
  if(!el)return;
  el.innerHTML=GS.log.slice(0,25).map(e=>`<div class="log-entry"><div class="log-year">Año ${e.year}</div><div class="log-text">${e.text}</div></div>`).join('');
}

/* ══════════ RENDER ══════════ */
function renderHUD(){
  if(!GS)return;
  document.getElementById('hud-year').textContent=GS.year;
  document.getElementById('hud-turn').textContent=Math.min(GS.turn,GS.maxTurns);

  // Valores con crisis visual
  const setHudVal=(id,barId,val,cardClass)=>{
    const el=document.getElementById(id);
    const bar=document.getElementById(barId);
    const card=el?.closest('.hud-card');
    el.textContent=val;
    if(bar)bar.style.width=Math.max(0,Math.min(100,val))+'%';
    if(card){
      card.classList.toggle('crisis',val<=20);
      el.classList.toggle('danger',val<=15);
    }
  };
  setHudVal('hud-poder','bar-poder',GS.poder);
  setHudVal('hud-estab','bar-estab',GS.estabilidad);
  setHudVal('hud-tec','bar-tec',GS.tecnologia);

  const pop=GS.poblacion>=1000?`${(GS.poblacion/1000).toFixed(1)}B`:`${GS.poblacion}M`;
  document.getElementById('hud-pop').textContent=pop;
  document.getElementById('hud-territory').textContent=`${GS.territorio} planeta${GS.territorio>1?'s':''}`;

  const pct=Math.round((GS.year/5000)*100);
  document.getElementById('year-fill').style.width=Math.min(pct,100)+'%';
  document.getElementById('progress-pct').textContent=pct+'%';
}

function renderEvoTrack(){
  if(!GS)return;
  document.getElementById('evo-inline').innerHTML=GS.evoLine.map((key,i)=>{
    const st=EVO[key];
    const cls=i<GS.evoStageIndex?'done':i===GS.evoStageIndex?'active':'locked';
    return`<div class="evo-node ${cls}" title="${st.periodo}"><div class="evo-node-dot">${st.icon}</div><div class="evo-node-name">${st.name}</div></div>`;
  }).join('');
}

function renderCiviStatus(){
  if(!GS)return;
  const stage=EVO[GS.evoLine[GS.evoStageIndex]];
  document.getElementById('cs-gobierno').textContent=stage.gov;
  document.getElementById('cs-economia').textContent=stage.eco;
  document.getElementById('cs-militar').textContent=stage.mil;
  document.getElementById('cs-etapa').textContent=stage.name;
  const traitsEl=document.getElementById('cs-traits');
  if(traitsEl){
    traitsEl.innerHTML=GS.civTraits.length?GS.civTraits.map(t=>`<span class="civ-trait-mini">${t.label}</span>`).join(''):'<span style="color:var(--text-dim);font-size:9px">Sin rasgos</span>';
  }
}

const TYPE_LABELS={social:'Social',cientifico:'Científico',politico:'Político',militar:'Militar',catastrofe:'Catástrofe',expansion:'Expansión',biologico:'Biológico',cultural:'Cultural'};

function renderTurnPanel(){
  if(!GS)return;
  const yearEnd=GS.year+4;
  document.getElementById('turn-title').textContent=`Turno ${Math.min(GS.turn,GS.maxTurns)}`;
  document.getElementById('turn-year-badge').textContent=`Año ${GS.year}–${yearEnd}`;

  // Nota anterior
  if(GS.pendingNote){
    const tn=document.getElementById('turn-note');
    tn.style.display='block';
    document.getElementById('turn-note-text').innerHTML=GS.pendingNote;
    GS.pendingNote=null;
  }

  // Seleccionar evento
  const ev=getEventForTurn(GS);
  GS.currentEvent=ev;

  const typeLabel=TYPE_LABELS[ev.type]||ev.type;

  // Renderizar evento + 3 decisiones
  document.getElementById('event-area').innerHTML=`
    <div class="event-display ev-${ev.type}">
      <div class="event-top">
        <div class="event-icon-big">${ev.icon}</div>
        <div class="event-body">
          <span class="event-type-badge">${typeLabel}</span>
          <div class="event-title">${ev.title}</div>
          <div class="event-desc">${ev.desc(GS)}</div>
        </div>
      </div>
    </div>
    <div class="decisions-label">// Elige cómo responder //</div>
    <div class="decisions-grid">
      ${ev.decisions.map((dec,i)=>{
        const fx=dec.effects;
        const tags=Object.entries(fx).map(([k,v])=>{
          if(v===0)return'';
          const lab={poder:'Poder',estabilidad:'Estabilidad',tecnologia:'Tecnología',poblacion:'Población',territorio:'Territorio'}[k]||k;
          return`<span class="effect-tag ${v>0?'effect-pos':'effect-neg'}">${lab} ${v>0?'+':''}${v}</span>`;
        }).filter(Boolean).join('');
        const traitHtml=dec.trait?`<div class="decision-unlock">🏷 Rasgo: ${dec.trait.label}</div>`:'';
        const unlocksHtml=dec.unlocks.length?`<div class="decision-unlock">🔓 Abre: ${dec.unlocks.join(', ')}</div>`:'';
        const blocksHtml=dec.blocks.length?`<div class="decision-unlock" style="color:var(--red)">🔒 Cierra: ${dec.blocks.join(', ')}</div>`:'';
        return`<div class="decision-card" onclick="chooseDecision(${i})">
          <div class="decision-letter">Opción ${dec.letter}</div>
          <div class="decision-title">${dec.title}</div>
          <div class="decision-desc">${dec.desc}</div>
          <div class="decision-effects">${tags}</div>
          ${traitHtml}${unlocksHtml}${blocksHtml}
        </div>`;
      }).join('')}
    </div>`;
}

/* ══════════ FINAL JUDGMENT ══════════ */
function showFinalJudgment(){
  document.getElementById('game-phase').style.display='none';
  const fs=document.getElementById('final-screen');fs.style.display='block';
  let v;
  if(GS.poder>=85&&GS.territorio>=5)         v={icon:'🌌',name:'LEGENDARIO',sub:'Tu Imperio trascendió los límites del cosmos conocido.',color:'#a8ff5a'};
  else if(GS.tecnologia>=80&&GS.poder>=60)    v={icon:'✨',name:'TRASCENDENTE',sub:'La ciencia elevó a tu especie más allá de lo biológico.',color:'#5ef5c0'};
  else if(GS.poder>=65&&GS.estabilidad>=60)   v={icon:'⭐',name:'GLORIOSO',sub:'Un Imperio que brillará en los anales galácticos.',color:'#e8c44a'};
  else if(GS.estabilidad>=70&&GS.poder>=40)   v={icon:'🏛️',name:'ESTABLECIDO',sub:'Una civilización sólida que perduró en el tiempo.',color:'#7fff3a'};
  else if(GS.estabilidad<20||GS.poder<10)     v={icon:'💀',name:'COLAPSADO',sub:'El Imperio no pudo sobrevivir a sus propias contradicciones.',color:'#ff4d3a'};
  else if(GS.tecnologia<20)                    v={icon:'🌑',name:'ESTANCADO',sub:'Sobrevivió pero nunca alcanzó su potencial.',color:'#556030'};
  else                                          v={icon:'🌿',name:'RESILIENTE',sub:'Modesto pero indestructible. 5000 años de historia.',color:'#7fff3a'};
  document.getElementById('final-icon').textContent=v.icon;
  document.getElementById('final-name').textContent=v.name;
  document.getElementById('final-name').style.color=v.color;
  document.getElementById('final-sub').textContent=v.sub;
  // Shield in final screen (remove old if any)
  const oldShield=document.getElementById('final-shield-wrap');
  if(oldShield)oldShield.remove();
  const shieldSrc=document.getElementById('shield-canvas');
  if(shieldSrc){
    const wrap=document.createElement('div');
    wrap.id='final-shield-wrap';wrap.style.cssText='text-align:center;margin-bottom:20px';
    const img=document.createElement('img');
    img.src=shieldSrc.toDataURL();img.width=100;img.height=115;
    img.style.cssText='display:inline-block;filter:drop-shadow(0 0 12px rgba(127,255,58,.4))';
    wrap.appendChild(img);
    document.getElementById('final-sub').insertAdjacentElement('afterend',wrap);
  }
  const stage=EVO[GS.evoLine[GS.evoStageIndex]];
  const traitsHtml=GS.civTraits.map(t=>`<span class="civ-trait-badge">${t.label}</span>`).join(' ')||'Ninguno';
  document.getElementById('final-stats').innerHTML=[
    {label:'Poder',value:GS.poder,color:'#7fff3a'},
    {label:'Estabilidad',value:GS.estabilidad,color:'#e8c44a'},
    {label:'Tecnología',value:GS.tecnologia,color:'#5ef5c0'},
    {label:'Etapa final',value:stage.name,color:'#cce890'},
    {label:'Territorio',value:GS.territorio+' planetas',color:'#cce890'},
    {label:'Población',value:GS.poblacion>=1000?(GS.poblacion/1000).toFixed(1)+'B':GS.poblacion+'M',color:'#cce890'},
  ].map(s=>`<div class="final-stat"><div class="final-stat-label">${s.label}</div><div class="final-stat-value" style="color:${s.color}">${s.value}</div></div>`).join('');
  document.getElementById('final-chronicle').innerHTML=`<p style="margin-bottom:10px"><strong style="color:var(--green)">Rasgos de civilización:</strong> ${traitsHtml}</p>`+GS.chronicle.slice(0,12).map(e=>`<p style="margin-bottom:7px"><span style="color:var(--amber);font-size:9px">Año ${e.year}</span> — ${e.text}</p>`).join('');
  fs.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ══════════ RANDOMIZE ══════════ */
function randomize(){
  const F={tamano:['enano','pequeno','terrestre','supertierra','mininetuno'],estrella:['enana_roja','enana_naranja','sol_like','subgigante_f'],distancia:['muy_cercano','cercano','medio','lejano','muy_lejano'],temperatura:['helado','frio','templado','caliente'],atmosfera:['tenue','delgada','terrestre','densa','muy_densa'],geologia:['inerte','baja','moderada','alta','extrema'],stellarActivity:['quiet','moderate','active','extreme'],magneticField:['none','weak','earth-like','strong'],agua:['0','10','30','50','71','85','95'],precipitaciones:['arido','estacional','frecuente','tormentas'],suelo:['rocoso','arenoso','volcanico','selvatico','helado','salino'],tipo_fisico:['humanoide','reptiliano','insectoide','energetico'],altura:['baja','media','alta','gigante'],metabolismo:['carnivoro','herbivoro','omnivoro','fotosintetico'],religion:['cosmico','naturaleza','ancestros','ciencia']};
  Object.entries(F).forEach(([id,opts])=>{const el=document.getElementById(id);if(el)el.value=opts[Math.floor(Math.random()*opts.length)]});
  document.querySelectorAll('select').forEach(s=>{s.style.borderColor='var(--amber)';setTimeout(()=>s.style.borderColor='',500)});
  applyConstraints();updatePlanet();
}

/* ══════════ SHIELD BUILDER ══════════ */
function drawShield(){
  const cv=document.getElementById('shield-canvas');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);

  const shape=document.getElementById('shield-shape')?.value||'classic';
  const symbol=document.getElementById('shield-symbol')?.value||'star';
  const symbol2=document.getElementById('shield-symbol2')?.value||'none';
  const c1=document.getElementById('shield-color1')?.value||'#0a2a0a';
  const c2=document.getElementById('shield-color2')?.value||'#7fff3a';

  const cx=W/2,cy=H/2+4;

  // ── Draw shield shape ──────────────────────────────
  ctx.save();
  ctx.beginPath();
  if(shape==='classic'){
    // Classic heater shield
    ctx.moveTo(cx,cy+58);
    ctx.bezierCurveTo(cx,cy+58,cx-58,cy+20,cx-58,cy-30);
    ctx.lineTo(cx-58,cy-58);ctx.lineTo(cx+58,cy-58);
    ctx.lineTo(cx+58,cy-30);
    ctx.bezierCurveTo(cx+58,cy+20,cx,cy+58,cx,cy+58);
  } else if(shape==='kite'){
    ctx.moveTo(cx,cy+70);
    ctx.lineTo(cx-52,cy+10);ctx.lineTo(cx-52,cy-55);
    ctx.lineTo(cx+52,cy-55);ctx.lineTo(cx+52,cy+10);
    ctx.closePath();
  } else if(shape==='round'){
    ctx.arc(cx,cy,60,0,Math.PI*2);
  } else if(shape==='hex'){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3-Math.PI/6;
      i===0?ctx.moveTo(cx+62*Math.cos(a),cy+62*Math.sin(a)):ctx.lineTo(cx+62*Math.cos(a),cy+62*Math.sin(a));
    }
    ctx.closePath();
  }

  // Fill with gradient - more vivid
  const grad=ctx.createLinearGradient(cx-55,cy-58,cx+55,cy+60);
  grad.addColorStop(0,lighten(c1,55));
  grad.addColorStop(0.5,lighten(c1,25));
  grad.addColorStop(1,c1);
  ctx.fillStyle=grad;ctx.fill();

  // Border
  ctx.strokeStyle=c2;ctx.lineWidth=3;
  ctx.shadowColor=c2;ctx.shadowBlur=8;
  ctx.stroke();ctx.shadowBlur=0;

  // Inner border line
  ctx.strokeStyle=`${c2}55`;ctx.lineWidth=1;
  ctx.stroke();
  ctx.restore();

  // ── Clip to shield for interior decoration ─────────
  ctx.save();
  ctx.beginPath();
  if(shape==='classic'){
    ctx.moveTo(cx,cy+58);
    ctx.bezierCurveTo(cx,cy+58,cx-58,cy+20,cx-58,cy-30);
    ctx.lineTo(cx-58,cy-58);ctx.lineTo(cx+58,cy-58);
    ctx.lineTo(cx+58,cy-30);
    ctx.bezierCurveTo(cx+58,cy+20,cx,cy+58,cx,cy+58);
  } else if(shape==='kite'){
    ctx.moveTo(cx,cy+70);
    ctx.lineTo(cx-52,cy+10);ctx.lineTo(cx-52,cy-55);
    ctx.lineTo(cx+52,cy-55);ctx.lineTo(cx+52,cy+10);
    ctx.closePath();
  } else if(shape==='round'){
    ctx.arc(cx,cy,60,0,Math.PI*2);
  } else {
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3-Math.PI/6;
      i===0?ctx.moveTo(cx+62*Math.cos(a),cy+62*Math.sin(a)):ctx.lineTo(cx+62*Math.cos(a),cy+62*Math.sin(a));
    }
    ctx.closePath();
  }
  ctx.clip();

  // Subtle horizontal stripes
  ctx.globalAlpha=0.06;
  for(let y=cy-60;y<cy+70;y+=10){
    ctx.fillStyle=c2;ctx.fillRect(cx-65,y,130,4);
  }
  ctx.globalAlpha=1;

  // Central dividing line
  ctx.strokeStyle=`${c2}30`;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx,cy-58);ctx.lineTo(cx,cy+70);ctx.stroke();
  ctx.restore();

  // ── Draw symbol ────────────────────────────────────
  ctx.save();
  ctx.shadowColor=c2;ctx.shadowBlur=12;
  ctx.fillStyle=c2;ctx.strokeStyle=c2;

  const s=28; // symbol size
  ctx.translate(cx,cy+2);

  if(symbol==='star'){
    drawStar(ctx,0,0,s,s*0.42,5);
    ctx.fill();
  } else if(symbol==='eye'){
    // Eye shape
    ctx.beginPath();
    ctx.moveTo(-s,0);ctx.quadraticCurveTo(0,-s*0.65,s,0);
    ctx.quadraticCurveTo(0,s*0.65,-s,0);
    ctx.fillStyle=c2;ctx.fill();
    ctx.fillStyle=c1;
    ctx.beginPath();ctx.arc(0,0,s*0.35,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c2;
    ctx.beginPath();ctx.arc(0,0,s*0.16,0,Math.PI*2);ctx.fill();
  } else if(symbol==='fist'){
    ctx.lineWidth=3;
    // Simplified fist as rounded rect stack
    for(let f=0;f<4;f++){
      ctx.beginPath();
      ctx.roundRect(-s*0.45,-s*0.55+f*(s*0.28),s*0.9,s*0.24,4);
      ctx.fill();
    }
    ctx.beginPath();ctx.roundRect(-s*0.45,s*0.1,s*0.9,s*0.45,4);ctx.fill();
  } else if(symbol==='leaf'){
    ctx.beginPath();
    ctx.moveTo(0,-s);ctx.bezierCurveTo(s,-s*0.3,s*0.5,s*0.5,0,s);
    ctx.bezierCurveTo(-s*0.5,s*0.5,-s,-s*0.3,0,-s);
    ctx.fill();
    ctx.strokeStyle=c1;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s);ctx.stroke();
  } else if(symbol==='atom'){
    ctx.lineWidth=2.5;ctx.fillStyle='transparent';
    for(let angle=0;angle<Math.PI;angle+=Math.PI/3){
      ctx.save();ctx.rotate(angle);
      ctx.beginPath();ctx.ellipse(0,0,s,s*0.38,0,0,Math.PI*2);
      ctx.strokeStyle=c2;ctx.stroke();ctx.restore();
    }
    ctx.fillStyle=c2;ctx.beginPath();ctx.arc(0,0,s*0.18,0,Math.PI*2);ctx.fill();
  } else if(symbol==='crown'){
    ctx.beginPath();
    ctx.moveTo(-s,-s*0.15);ctx.lineTo(-s,s*0.55);ctx.lineTo(s,s*0.55);ctx.lineTo(s,-s*0.15);
    ctx.lineTo(s*0.5,s*0.2);ctx.lineTo(0,-s*0.6);ctx.lineTo(-s*0.5,s*0.2);ctx.closePath();
    ctx.fill();
  } else if(symbol==='flame'){
    ctx.beginPath();
    ctx.moveTo(0,s);
    ctx.bezierCurveTo(-s,s*0.2,-s*0.5,-s*0.4,0,-s);
    ctx.bezierCurveTo(s*0.5,-s*0.4,s,s*0.2,0,s);
    ctx.fill();
    ctx.fillStyle=darken(c1,0);
    ctx.beginPath();ctx.ellipse(0,s*0.2,s*0.28,s*0.4,0,0,Math.PI*2);ctx.fill();
  } else if(symbol==='wave'){
    ctx.lineWidth=4;ctx.lineJoin='round';ctx.lineCap='round';
    for(let w=0;w<3;w++){
      ctx.beginPath();
      ctx.moveTo(-s,w*s*0.38-s*0.3);
      ctx.quadraticCurveTo(-s*0.3,w*s*0.38-s*0.65,0,w*s*0.38-s*0.3);
      ctx.quadraticCurveTo(s*0.3,w*s*0.38+s*0.05,s,w*s*0.38-s*0.3);
      ctx.strokeStyle=c2;ctx.stroke();
    }
  }
  ctx.restore();

  // ── Secondary symbol (small, top-left of center) ──
  if(symbol2!=='none'){
    const s2=11; // smaller size
    const ox=cx-16, oy=cy-16; // top-left offset from center
    ctx.save();
    ctx.shadowColor=c2;ctx.shadowBlur=6;
    ctx.fillStyle=c2;ctx.strokeStyle=c2;
    ctx.translate(ox,oy);
    if(symbol2==='star'){drawStar(ctx,0,0,s2,s2*0.42,5);ctx.fill();}
    else if(symbol2==='eye'){
      ctx.beginPath();ctx.moveTo(-s2,0);ctx.quadraticCurveTo(0,-s2*0.65,s2,0);ctx.quadraticCurveTo(0,s2*0.65,-s2,0);ctx.fill();
      ctx.fillStyle=c1;ctx.beginPath();ctx.arc(0,0,s2*0.35,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c2;ctx.beginPath();ctx.arc(0,0,s2*0.16,0,Math.PI*2);ctx.fill();
    }
    else if(symbol2==='fist'){for(let f=0;f<4;f++){ctx.beginPath();ctx.roundRect(-s2*0.45,-s2*0.55+f*(s2*0.28),s2*0.9,s2*0.24,2);ctx.fill();}ctx.beginPath();ctx.roundRect(-s2*0.45,s2*0.1,s2*0.9,s2*0.45,2);ctx.fill();}
    else if(symbol2==='leaf'){ctx.beginPath();ctx.moveTo(0,-s2);ctx.bezierCurveTo(s2,-s2*0.3,s2*0.5,s2*0.5,0,s2);ctx.bezierCurveTo(-s2*0.5,s2*0.5,-s2,-s2*0.3,0,-s2);ctx.fill();}
    else if(symbol2==='atom'){ctx.lineWidth=1.5;for(let a=0;a<Math.PI;a+=Math.PI/3){ctx.save();ctx.rotate(a);ctx.beginPath();ctx.ellipse(0,0,s2,s2*0.38,0,0,Math.PI*2);ctx.strokeStyle=c2;ctx.stroke();ctx.restore();}ctx.beginPath();ctx.arc(0,0,s2*0.2,0,Math.PI*2);ctx.fill();}
    else if(symbol2==='crown'){ctx.beginPath();ctx.moveTo(-s2,-s2*0.15);ctx.lineTo(-s2,s2*0.55);ctx.lineTo(s2,s2*0.55);ctx.lineTo(s2,-s2*0.15);ctx.lineTo(s2*0.5,s2*0.2);ctx.lineTo(0,-s2*0.6);ctx.lineTo(-s2*0.5,s2*0.2);ctx.closePath();ctx.fill();}
    else if(symbol2==='flame'){ctx.beginPath();ctx.moveTo(0,s2);ctx.bezierCurveTo(-s2,s2*0.2,-s2*0.5,-s2*0.4,0,-s2);ctx.bezierCurveTo(s2*0.5,-s2*0.4,s2,s2*0.2,0,s2);ctx.fill();}
    else if(symbol2==='wave'){ctx.lineWidth=2;for(let w=0;w<3;w++){ctx.beginPath();ctx.moveTo(-s2,w*s2*0.38-s2*0.3);ctx.quadraticCurveTo(-s2*0.3,w*s2*0.38-s2*0.65,0,w*s2*0.38-s2*0.3);ctx.quadraticCurveTo(s2*0.3,w*s2*0.38+s2*0.05,s2,w*s2*0.38-s2*0.3);ctx.strokeStyle=c2;ctx.stroke();}}
    ctx.restore();
  }

  // Empire name text below symbol
  const empName=(typeof GS!=='undefined'&&GS)?GS.name:'';
  if(empName){
    ctx.fillStyle=`${c2}88`;ctx.font=`bold 9px 'Share Tech Mono'`;
    ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText(empName.slice(0,16),cx,H-4);
  }
}

function drawStar(ctx,cx,cy,outerR,innerR,points){
  ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const r=i%2===0?outerR:innerR;
    const a=i*Math.PI/points-Math.PI/2;
    i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }
  ctx.closePath();
}

function hexA(hex,a){
  if(!hex||hex.length<7)return`rgba(127,200,58,${a})`;
  const r=parseInt(hex.slice(1,3),16)||0;
  const g=parseInt(hex.slice(3,5),16)||0;
  const b=parseInt(hex.slice(5,7),16)||0;
  return`rgba(${r},${g},${b},${a})`;
}
function lighten(hex,amt){
  if(!hex||hex.length<7)return hex||'#7fff3a';
  const r=Math.max(0,Math.min(255,parseInt(hex.slice(1,3),16)+amt));
  const g=Math.max(0,Math.min(255,parseInt(hex.slice(3,5),16)+amt));
  const b=Math.max(0,Math.min(255,parseInt(hex.slice(5,7),16)+amt));
  return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function darken(hex,amt){return lighten(hex,-amt)}

function randomShield(){
  const shapes=['classic','kite','round','hex'];
  const symbols=['star','eye','fist','leaf','atom','crown','flame','wave'];
  const colors1=['#0d5c1a','#0d2a6e','#6e0d0d','#6e4e0d','#4a0d6e','#0d5c5c'];
  const colors2=['#7fff3a','#e8c44a','#5ef5c0','#ff4d3a','#ffffff','#c89fff'];
  function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
  document.getElementById('shield-shape').value=pick(shapes);
  document.getElementById('shield-symbol').value=pick(symbols);
  document.getElementById('shield-symbol2').value=pick(['none','none',...symbols]); // none más probable
  document.getElementById('shield-color1').value=pick(colors1);
  document.getElementById('shield-color2').value=pick(colors2);
  drawShield();
}

/* ══════════ CONFIG MODE TOGGLE (Manual / Aleatorio) ══════════ */
let _configMode='manual';

function setConfigMode(mode){
  _configMode=mode;
  const bManual=document.getElementById('btn-mode-manual');
  const bRandom=document.getElementById('btn-mode-random');
  if(mode==='manual'){
    bManual.style.background='rgba(127,255,58,.12)';bManual.style.color='var(--green)';
    bRandom.style.background='transparent';bRandom.style.color='var(--text-dim)';
    // Unlock all selects
    document.querySelectorAll('#config-phase select').forEach(s=>s.disabled=false);
  } else {
    bRandom.style.background='rgba(232,196,74,.12)';bRandom.style.color='var(--amber)';
    bManual.style.background='transparent';bManual.style.color='var(--text-dim)';
    // Randomize and lock all selects
    randomize();
    document.querySelectorAll('#config-phase select').forEach(s=>s.disabled=true);
    // But allow shield selects
    ['shield-shape','shield-symbol','shield-symbol2','shield-color1','shield-color2'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.disabled=false;
    });
  }
}

/* ══════════ RESET ══════════ */
function resetGame(){
  GS=null;
  _milestoneQueue=[];_milestoneActive=false;
  document.getElementById('config-phase').style.display='block';
  document.getElementById('game-phase').style.display='none';
  document.getElementById('final-screen').style.display='none';
  document.getElementById('collapse-screen').classList.remove('show');
  document.getElementById('milestone-overlay').classList.remove('show');
  document.getElementById('era-transition').classList.remove('show');
  document.getElementById('turn-note').style.display='none';
  setConfigMode('manual');
  updatePlanet();drawShield();
  _extResetGame(); // new systems reset
}

/* ════════════════════════════════════════════════════════
   SISTEMA A: CIVILIZACIONES RIVALES (UNIVERSO VIVO)
════════════════════════════════════════════════════════ */
const ALIEN_NAMES=['Vor\'kath','Xen-Ular','Aethion','Nek\'sol','Druvari','Pharoi','Solven','Kaelthos','Umvex','Zirath'];
const SPECIES_TYPES=['cristalino','fluido','enjambre','energético','silíceo','mamífero','reptiliano','insectoide'];
const TEMPERAMENTS=['pacifista','científico','expansionista','imperialista','xenófobo','comerciante'];
const TEMPERAMENT_ICONS={pacifista:'🕊️',científico:'🔬',expansionista:'🚀',imperialista:'⚔️',xenófobo:'🔒',comerciante:'💱'};

function generateGalaxyCivs(){
  const civs=[];
  const n=3+Math.floor(Math.random()*4); // 3-6 civilizations
  for(let i=0;i<n;i++){
    civs.push({
      id:`civ_${i}`,
      name:ALIEN_NAMES[i%ALIEN_NAMES.length],
      speciesType:SPECIES_TYPES[Math.floor(Math.random()*SPECIES_TYPES.length)],
      homePlanetType:['oceánico','volcánico','helado','árido','gaseoso'][Math.floor(Math.random()*5)],
      techLevel:Math.floor(Math.random()*60)+10,      // 10–70 at game start
      population:Math.floor(Math.random()*500)+50,    // millions
      temperament:TEMPERAMENTS[Math.floor(Math.random()*TEMPERAMENTS.length)],
      expansionism:Math.floor(Math.random()*100),
      militaryPower:Math.floor(Math.random()*80)+10,
      cultureTraits:[],
      firstContacted:false,
      relation:'desconocida',  // desconocida | neutral | aliada | rival | guerra | vasallo
      tradeLevel:0,
      contactTurn:null,
    });
  }
  return civs;
}

function tickGalaxyCivs(gs){
  if(!gs.galaxyCivs)return;
  gs.galaxyCivs.forEach(civ=>{
    // Slow background evolution
    civ.techLevel=Math.min(100,civ.techLevel+Math.random()*0.3);
    civ.population+=Math.floor(Math.random()*3);
    if(civ.temperament==='expansionista') civ.militaryPower=Math.min(100,civ.militaryPower+0.2);
    // Trade bonus if allied
    if(civ.relation==='aliada'&&Math.random()<0.3) gs.tecnologia=Math.min(100,gs.tecnologia+1);
    // War attrition
    if(civ.relation==='guerra'&&Math.random()<0.2){
      gs.poder=Math.max(0,gs.poder-1);
      gs.estabilidad=Math.max(0,gs.estabilidad-1);
    }
  });
}

// First contact events — triggered when reaching orbital+ stage
const FIRST_CONTACT_EVENTS=[
  {icon:'📡',title:'Señal de Radio Alienígena',desc:civ=>`Los radiotelescopios detectan una señal matemáticamente codificada proveniente del sistema de ${civ.name}. Es inequívocamente inteligente.`,type:'expansion'},
  {icon:'🛸',title:'Sonda Extraterrestre',desc:civ=>`Una sonda de diseño desconocido entra en el sistema solar. Los análisis confirman que pertenece a ${civ.name}.`,type:'expansion'},
  {icon:'🏛️',title:'Ruinas de Civilización Antigua',desc:civ=>`Exploradores descubren ruinas de una civilización que se identifica como precursora de ${civ.name}. Tecnología milenaria intacta.`,type:'cientifico'},
  {icon:'🌌',title:'Imperio Galáctico Conocido',desc:civ=>`El Imperio descubre que ${civ.name} ya controla múltiples sistemas estelares. Son mucho más avanzados de lo esperado.`,type:'politico'},
];

// Post-contact event types
const GALACTIC_EVENTS=[
  {id:'gal_diplomacia',icon:'🤝',type:'politico',title:'Propuesta Diplomática',
   desc:gs=>{const civ=getFirstContactedCiv(gs);return`${civ?.name||'Los alienígenas'} proponen establecer relaciones diplomáticas formales. El universo podría ser menos solitario.`},
   decisions:[
     {letter:'A',title:'Embajada permanente',desc:'Abrimos canales diplomáticos completos.',effects:{estabilidad:+5,poder:+3},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:[],blocks:[]},
     {letter:'B',title:'Relaciones comerciales solo',desc:'Mantenemos distancia pero comerciamos.',effects:{poder:+2,tecnologia:+4},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:[],blocks:[]},
     {letter:'C',title:'Rechazar contacto',desc:'No nos fiamos de ninguna especie alienígena.',effects:{poder:+2,estabilidad:-2},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:[]},
   ],epoch:['orbital','sistema','interestelar','galactico']},
  {id:'gal_guerra',icon:'⚔️',type:'militar',title:'Guerra Galáctica',
   desc:gs=>{const civ=getFirstContactedCiv(gs,'imperialista');return`Las flotas de ${civ?.name||'un imperio rival'} han cruzado la frontera del sistema. La guerra ha comenzado.`},
   decisions:[
     {letter:'A',title:'Contraataque total',desc:'Movilizamos toda la flota. Victoria o extinción.',effects:{poder:+10,estabilidad:-8,poblacion:-15},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:[]},
     {letter:'B',title:'Defensa estratégica',desc:'Protegemos los planetas clave y negociamos.',effects:{poder:+4,estabilidad:-3,poblacion:-5},trait:null,unlocks:[],blocks:[]},
     {letter:'C',title:'Rendición negociada',desc:'Aceptamos ser vasallos a cambio de paz.',effects:{poder:-15,estabilidad:+5},trait:null,unlocks:[],blocks:[]},
   ],epoch:['sistema','interestelar','galactico']},
  {id:'gal_comercio',icon:'💱',type:'social',title:'Ruta Comercial Interestelar',
   desc:gs=>{const civ=getFirstContactedCiv(gs,'comerciante');return`Mercaderes de ${civ?.name||'una civilización vecina'} ofrecen abrir una ruta comercial permanente. El intercambio cultural podría ser transformador.`},
   decisions:[
     {letter:'A',title:'Acuerdo de libre comercio',desc:'Mercados abiertos. Riqueza y diversidad cultural.',effects:{tecnologia:+8,estabilidad:+3,poder:+2},trait:{id:'mercantil',label:'💰 Mercantil'},unlocks:[],blocks:[]},
     {letter:'B',title:'Comercio regulado',desc:'Solo tecnología, nada de intercambio cultural.',effects:{tecnologia:+5,poder:+3},trait:null,unlocks:[],blocks:[]},
     {letter:'C',title:'Rechazar',desc:'Autarquía galáctica. Independencia total.',effects:{estabilidad:+2,poder:-1},trait:null,unlocks:[],blocks:[]},
   ],epoch:['orbital','sistema','interestelar','galactico']},
];

function getFirstContactedCiv(gs,temperament){
  if(!gs.galaxyCivs)return null;
  const contacted=gs.galaxyCivs.filter(c=>c.firstContacted);
  if(temperament) return contacted.find(c=>c.temperament===temperament)||contacted[0]||null;
  return contacted[0]||null;
}

function tryFirstContact(gs){
  if(!gs.galaxyCivs)return null;
  const stage=gs.evoLine[gs.evoStageIndex];
  if(!['orbital','sistema','interestelar','galactico','trascendente'].includes(stage))return null;
  const uncontacted=gs.galaxyCivs.filter(c=>!c.firstContacted);
  if(uncontacted.length===0)return null;
  if(Math.random()>0.25)return null; // 25% chance per turn in space era
  const civ=uncontacted[Math.floor(Math.random()*uncontacted.length)];
  civ.firstContacted=true;
  civ.relation='neutral';
  civ.contactTurn=gs.turn;
  const template=FIRST_CONTACT_EVENTS[Math.floor(Math.random()*FIRST_CONTACT_EVENTS.length)];
  return{
    id:`contact_${civ.id}`,
    icon:template.icon,
    type:template.type,
    title:template.title,
    desc:()=>template.desc(civ),
    epoch:[stage],
    decisions:[
      {letter:'A',title:'Responder amistosamente',desc:`Enviamos un mensaje de paz a ${civ.name}.`,effects:{estabilidad:+4,poder:+2,tecnologia:+3},trait:{id:'diplomática',label:'🤝 Diplomática'},unlocks:[],blocks:[]},
      {letter:'B',title:'Observar en silencio',desc:'Estudiamos antes de revelar nuestra posición.',effects:{tecnologia:+6,estabilidad:+1},trait:{id:'cientifica',label:'🔬 Científica'},unlocks:[],blocks:[]},
      {letter:'C',title:'Prepararse militarmente',desc:`Tratamos a ${civ.name} como amenaza potencial.`,effects:{poder:+7,estabilidad:-3},trait:{id:'belicosa',label:'⚔️ Belicosa'},unlocks:[],blocks:[]},
    ],
  };
}

function renderGalacticPanel(){
  const el=document.getElementById('galactic-panel');
  if(!el||!GS||!GS.galaxyCivs)return;
  const contacted=GS.galaxyCivs.filter(c=>c.firstContacted);
  if(contacted.length===0){
    el.innerHTML=`<div style="color:var(--text-dim);font-size:10px;text-align:center;padding:8px">Sin contacto interestelar aún</div>`;
    return;
  }
  const relColors={neutral:'#cce890',aliada:'#7fff3a',rival:'#ff8040',guerra:'#ff4d3a',vasallo:'#c89fff',desconocida:'#556030'};
  el.innerHTML=contacted.map(civ=>`
    <div style="margin-bottom:8px;padding:8px;background:rgba(8,11,3,.5);border:1px solid var(--border);border-radius:4px;font-size:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="color:var(--text)">${TEMPERAMENT_ICONS[civ.temperament]||'👽'} ${civ.name}</span>
        <span style="color:${relColors[civ.relation]||'#cce890'};font-size:9px;letter-spacing:1px;text-transform:uppercase">${civ.relation}</span>
      </div>
      <div style="color:var(--text-dim)">Tec: <span style="color:var(--cyan)">${Math.round(civ.techLevel)}</span> · ${civ.speciesType} · ${civ.temperament}</div>
      <div style="height:3px;background:var(--border);border-radius:2px;margin-top:4px"><div style="height:100%;width:${civ.techLevel}%;background:var(--cyan);border-radius:2px"></div></div>
    </div>`).join('');
}

/* ════════════════════════════════════════════════════════
   SISTEMA B: CLASES SOCIALES CON PODER POLÍTICO
════════════════════════════════════════════════════════ */
function initSocialClasses(gs){
  gs.socialClasses={
    military:    {label:'⚔️ Militares',    pct:12, happiness:60, influence:15, radicalization:0},
    scientists:  {label:'🔬 Científicos',  pct:8,  happiness:70, influence:12, radicalization:0},
    colonists:   {label:'🏕️ Colonos',      pct:10, happiness:55, influence:8,  radicalization:0},
    religious:   {label:'📖 Religiosos',   pct:15, happiness:65, influence:14, radicalization:0},
    philosophers:{label:'🎭 Filósofos',    pct:5,  happiness:75, influence:7,  radicalization:0},
    workers:     {label:'⚒️ Trabajadores', pct:30, happiness:50, influence:10, radicalization:0},
    merchants:   {label:'💰 Mercaderes',   pct:10, happiness:60, influence:12, radicalization:0},
    artists:     {label:'🎨 Artistas',     pct:5,  happiness:68, influence:6,  radicalization:0},
    engineers:   {label:'⚙️ Ingenieros',   pct:5,  happiness:65, influence:10, radicalization:0},
  };
}

function getDominantClass(gs){
  if(!gs.socialClasses)return null;
  return Object.entries(gs.socialClasses).sort((a,b)=>b[1].influence-a[1].influence)[0];
}

function tickSocialClasses(gs){
  if(!gs.socialClasses)return;
  const sc=gs.socialClasses;
  // Global stability affects happiness
  const stabFactor=(gs.estabilidad-50)/100;
  Object.values(sc).forEach(cls=>{
    cls.happiness=Math.max(0,Math.min(100,cls.happiness+stabFactor*2+(Math.random()*2-1)));
    // Radicalization rises when unhappy
    if(cls.happiness<30) cls.radicalization=Math.min(100,cls.radicalization+2);
    else cls.radicalization=Math.max(0,cls.radicalization-1);
    // Influence decays toward baseline over time
    cls.influence=Math.max(1,Math.min(40,cls.influence+(Math.random()*0.4-0.2)));
  });
  // Dominant class effects
  const [domKey,domCls]=getDominantClass(gs)||[];
  if(domKey==='military'&&domCls.influence>25) gs.poder=Math.min(100,gs.poder+0.5);
  if(domKey==='scientists'&&domCls.influence>20) gs.tecnologia=Math.min(100,gs.tecnologia+0.5);
  if(domKey==='merchants'&&domCls.influence>20) gs.estabilidad=Math.min(100,gs.estabilidad+0.3);
  if(domKey==='religious'&&domCls.influence>25) gs.estabilidad=Math.min(100,gs.estabilidad+0.4);
}

function applySocialEffect(gs,key,influenceDelta,happinessDelta){
  if(!gs.socialClasses||!gs.socialClasses[key])return;
  const cls=gs.socialClasses[key];
  cls.influence=Math.max(1,Math.min(40,cls.influence+influenceDelta));
  cls.happiness=Math.max(0,Math.min(100,cls.happiness+happinessDelta));
}

function renderSocialPanel(){
  const el=document.getElementById('social-panel');
  if(!el||!GS||!GS.socialClasses)return;
  const entries=Object.entries(GS.socialClasses).sort((a,b)=>b[1].influence-a[1].influence);
  el.innerHTML=entries.map(([key,cls])=>{
    const radCol=cls.radicalization>60?'var(--red)':cls.radicalization>30?'var(--amber)':'var(--green-dim)';
    return`<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px">
        <span style="color:var(--text)">${cls.label}</span>
        <span style="color:var(--text-dim)">${cls.pct}% · inf:<span style="color:var(--cyan)">${Math.round(cls.influence)}</span></span>
      </div>
      <div style="display:flex;gap:3px">
        <div title="Felicidad" style="flex:1;height:4px;background:var(--border);border-radius:2px"><div style="height:100%;width:${cls.happiness}%;background:var(--amber);border-radius:2px"></div></div>
        <div title="Radicalización" style="flex:1;height:4px;background:var(--border);border-radius:2px"><div style="height:100%;width:${cls.radicalization}%;background:${radCol};border-radius:2px"></div></div>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   SISTEMA C: PRESIONES HISTÓRICAS
════════════════════════════════════════════════════════ */
function initHistoricalPressure(gs){
  gs.historicalPressure={
    militarism:0,      // → golpe militar, guerra civil
    pollution:0,       // → colapso ecológico, cambio climático
    religiousTension:0,// → revolución religiosa, teocracia forzada
    classConflict:0,   // → revolución social, secesión
    cosmicExposure:0,  // → contacto alienígena, invasión
    techRunaway:0,     // → singularidad, crisis IA
  };
}

function addPressure(gs,key,amount){
  if(!gs.historicalPressure)return;
  gs.historicalPressure[key]=Math.max(0,Math.min(100,(gs.historicalPressure[key]||0)+amount));
}

function tickPressures(gs){
  if(!gs.historicalPressure)return;
  const hp=gs.historicalPressure;
  // Natural decay
  Object.keys(hp).forEach(k=>hp[k]=Math.max(0,hp[k]-0.3));
  // Accumulate from game state
  if(gs.poder>70) addPressure(gs,'militarism',0.5);
  if(gs.tecnologia>60) addPressure(gs,'techRunaway',0.3);
  if(gs.evoStageIndex>=5) addPressure(gs,'cosmicExposure',0.4);
  if(gs.socialClasses){
    const sc=gs.socialClasses;
    if(sc.military?.radicalization>50) addPressure(gs,'militarism',1);
    if(sc.religious?.radicalization>50) addPressure(gs,'religiousTension',1);
    if(sc.workers?.radicalization>50) addPressure(gs,'classConflict',1);
  }
  // Check thresholds → trigger mega events
  checkPressureThresholds(gs);
}

function checkPressureThresholds(gs){
  const hp=gs.historicalPressure;
  if(!hp)return;
  if(hp.militarism>=75&&!gs._megaEventCooldown?.militarism){
    triggerMegaEvent(gs,'golpe_militar');
    gs._megaEventCooldown=gs._megaEventCooldown||{};
    gs._megaEventCooldown.militarism=gs.turn+60;
  }
  if(hp.pollution>=80&&!gs._megaEventCooldown?.pollution){
    triggerMegaEvent(gs,'colapso_ecologico');
    gs._megaEventCooldown=gs._megaEventCooldown||{};
    gs._megaEventCooldown.pollution=gs.turn+80;
  }
  if(hp.religiousTension>=70&&!gs._megaEventCooldown?.religion){
    triggerMegaEvent(gs,'revolucion_religiosa');
    gs._megaEventCooldown=gs._megaEventCooldown||{};
    gs._megaEventCooldown.religion=gs.turn+50;
  }
  if(hp.classConflict>=80&&gs.estabilidad<40&&!gs._megaEventCooldown?.classConflict){
    triggerMegaEvent(gs,'guerra_civil');
    gs._megaEventCooldown=gs._megaEventCooldown||{};
    gs._megaEventCooldown.classConflict=gs.turn+80;
  }
  // Reset expired cooldowns
  if(gs._megaEventCooldown){
    Object.keys(gs._megaEventCooldown).forEach(k=>{
      if(gs._megaEventCooldown[k]<=gs.turn) delete gs._megaEventCooldown[k];
    });
  }
}

/* ════════════════════════════════════════════════════════
   SISTEMA D: MEGAEVENTOS HISTÓRICOS
════════════════════════════════════════════════════════ */
const MEGA_EVENTS={
  asteroide:{
    icon:'☄️',title:'Impacto de Asteroide',
    desc:gs=>`Un asteroide de 10 km impacta en el planeta natal de ${gs.name}. El cielo se oscurece durante años. La civilización lucha por sobrevivir.`,
    effects:gs=>{gs.poblacion=Math.max(1,Math.round(gs.poblacion*0.75));gs.estabilidad=Math.max(0,gs.estabilidad-20);gs.poder=Math.max(0,gs.poder-15);},
    trait:{id:'resiliente',label:'🌿 Resiliente'},
    addPressure:null, minTurn:50,
  },
  supervolcan:{
    icon:'🌋',title:'Supervolcán Planetario',
    desc:gs=>`El mayor sistema volcánico del planeta entra en erupción. La ceniza cubre el ${Math.round(30+Math.random()*30)}% de la superficie durante décadas.`,
    effects:gs=>{gs.estabilidad=Math.max(0,gs.estabilidad-18);gs.poblacion=Math.max(1,Math.round(gs.poblacion*0.85));},
    trait:null, addPressure:{pollution:20}, minTurn:30,
  },
  golpe_militar:{
    icon:'⚔️',title:'Golpe Militar',
    desc:gs=>`Los generales de ${gs.name} han tomado el control del gobierno. El régimen civil colapsa en horas. Comienza una junta militar.`,
    effects:gs=>{gs.estabilidad=Math.max(0,gs.estabilidad-25);gs.poder=Math.min(100,gs.poder+10);if(gs.socialClasses){gs.socialClasses.military.influence=Math.min(40,gs.socialClasses.military.influence+15);}},
    trait:{id:'belicosa',label:'⚔️ Belicosa'}, addPressure:{militarism:-30}, minTurn:80,
  },
  guerra_civil:{
    icon:'💀',title:'Guerra Civil',
    desc:gs=>`El Imperio ${gs.name} se fractura. Dos facciones irreconciliables luchan por el control. El territorio se divide y la población sufre.`,
    effects:gs=>{gs.territorio=Math.max(1,gs.territorio-1);gs.poblacion=Math.max(1,Math.round(gs.poblacion*0.8));gs.estabilidad=Math.max(0,gs.estabilidad-30);gs.poder=Math.max(0,gs.poder-20);},
    trait:{id:'traumatizada',label:'💀 Traumatizada'}, addPressure:{classConflict:-40,militarism:-20}, minTurn:100,
  },
  revolucion_religiosa:{
    icon:'✝️',title:'Revolución Religiosa',
    desc:gs=>`Un movimiento espiritual radical toma el control político de ${gs.name}. La teocracia se impone por la fuerza. La ciencia sufre.`,
    effects:gs=>{gs.tecnologia=Math.max(0,gs.tecnologia-15);gs.estabilidad=Math.min(100,gs.estabilidad+10);if(gs.socialClasses){gs.socialClasses.religious.influence=Math.min(40,gs.socialClasses.religious.influence+18);}},
    trait:{id:'teocrática',label:'📖 Teocrática'}, addPressure:{religiousTension:-40}, minTurn:60,
  },
  colapso_ecologico:{
    icon:'☠️',title:'Colapso Ecológico',
    desc:gs=>`Los ecosistemas de ${gs.name} han alcanzado el punto de no retorno. La industrialización sin control ha devastado el planeta natal.`,
    effects:gs=>{gs.poblacion=Math.max(1,Math.round(gs.poblacion*0.7));gs.estabilidad=Math.max(0,gs.estabilidad-15);gs.poder=Math.max(0,gs.poder-10);},
    trait:{id:'ecológica',label:'🌿 Ecológica'}, addPressure:{pollution:-50}, minTurn:120,
  },
  tecnologia_alienigena:{
    icon:'🛸',title:'Tecnología Alienígena',
    desc:gs=>`Una sonda alienígena con tecnología incomprensible aterriza en ${gs.name}. Su análisis podría cambiar el curso de la civilización.`,
    effects:gs=>{gs.tecnologia=Math.min(100,gs.tecnologia+20);},
    trait:{id:'cientifica',label:'🔬 Científica'}, addPressure:null, minTurn:200,
  },
  invasion_alienigena:{
    icon:'👾',title:'Invasión Extraterrestre',
    desc:gs=>`Una flota alienígena de proporciones desconocidas aparece en el sistema de ${gs.name}. La mayor amenaza de su historia ha llegado.`,
    effects:gs=>{gs.poder=Math.min(100,gs.poder+15);gs.estabilidad=Math.max(0,gs.estabilidad-20);gs.poblacion=Math.max(1,Math.round(gs.poblacion*0.85));},
    trait:{id:'belicosa',label:'⚔️ Belicosa'}, addPressure:null, minTurn:300,
  },
};

// Random mega-event pool for periodic firing
const RANDOM_MEGA_POOL=['asteroide','supervolcan','tecnologia_alienigena'];
const SPACE_MEGA_POOL=['invasion_alienigena'];

let _lastMegaTurn=0;

function checkMegaEvents(gs){
  if(!gs)return;
  // Random mega events: ~1 every 40-80 turns
  const sinceLastMega=gs.turn-_lastMegaTurn;
  const threshold=40+Math.floor(Math.random()*40);
  if(sinceLastMega>=threshold&&Math.random()<0.4){
    // Pick pool based on era
    const pool=gs.evoStageIndex>=5?[...RANDOM_MEGA_POOL,...SPACE_MEGA_POOL]:RANDOM_MEGA_POOL;
    const key=pool[Math.floor(Math.random()*pool.length)];
    const ev=MEGA_EVENTS[key];
    if(ev&&gs.turn>=(ev.minTurn||0)){
      triggerMegaEvent(gs,key);
    }
  }
}

function triggerMegaEvent(gs,key){
  const ev=MEGA_EVENTS[key];
  if(!ev)return;
  _lastMegaTurn=gs.turn;
  // Apply effects
  ev.effects(gs);
  // Apply pressure changes
  if(ev.addPressure) Object.entries(ev.addPressure).forEach(([k,v])=>addPressure(gs,k,v));
  // Apply trait
  if(ev.trait){
    const already=gs.civTraits.find(t=>t.id===ev.trait.id);
    if(!already){gs.civTraits.push(ev.trait);if(gs.civTraits.length>8)gs.civTraits.shift();}
  }
  // Log and chronicle
  const desc=ev.desc(gs);
  addLog(gs.year,`⚡ MEGAEVENTO: ${ev.title}`);
  gs.chronicle.push({year:gs.year,text:`${ev.icon} MEGAEVENTO — ${ev.title}: ${desc}`});
  gs.pendingNote=`<span style="color:var(--red);font-family:Orbitron,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase">⚡ MEGAEVENTO</span><br><strong style="color:var(--amber)">${ev.icon} ${ev.title}</strong><br><span style="font-size:11px">${desc}</span>`;
  updateAccordionTraits?.();
  renderHUD?.();
}

/* ════════════════════════════════════════════════════════
   INTEGRACIÓN: extensiones de sistemas existentes
   Usamos callbacks en lugar de redeclarar funciones
   para evitar conflictos de hoisting.
════════════════════════════════════════════════════════ */

// Extension hooks called from existing functions
function _extFoundEmpire(){
  if(!GS)return;
  initSocialClasses(GS);
  initHistoricalPressure(GS);
  GS.galaxyCivs=generateGalaxyCivs();
  renderSocialPanel();
  renderGalacticPanel();
}

function _extAfterDecision(){
  if(!GS)return;
  const ev=GS.currentEvent;
  if(ev){
    if(ev.type==='militar') applySocialEffect(GS,'military',+2,+3);
    if(ev.type==='cientifico') applySocialEffect(GS,'scientists',+2,+5);
    if(ev.type==='cultural') applySocialEffect(GS,'artists',+2,+4);
    if(ev.type==='social') applySocialEffect(GS,'workers',+1,+3);
    if(ev.type==='politico') applySocialEffect(GS,'philosophers',+1,+2);
  }
  tickSocialClasses(GS);
  tickGalaxyCivs(GS);
  tickPressures(GS);
  checkMegaEvents(GS);
  const contactEv=tryFirstContact(GS);
  if(contactEv) GS._pendingContactEvent=contactEv;
  renderSocialPanel();
  renderGalacticPanel();
}

function _extAfterInvestment(area){
  if(!GS)return;
  if(area==='poder') applySocialEffect(GS,'military',+2,+2);
  if(area==='tecnologia') applySocialEffect(GS,'scientists',+2,+3);
  if(area==='estabilidad') applySocialEffect(GS,'workers',+1,+2);
  if(area==='poder') addPressure(GS,'militarism',1.5);
  if(area==='tecnologia') addPressure(GS,'techRunaway',0.8);
  renderSocialPanel();
}

function _extGetEvent(gs){
  if(gs._pendingContactEvent){
    const ev=gs._pendingContactEvent;
    gs._pendingContactEvent=null;
    return ev;
  }
  const stage=gs.evoLine[gs.evoStageIndex];
  if(['orbital','sistema','interestelar','galactico'].includes(stage)&&
     gs.galaxyCivs?.some(c=>c.firstContacted)&&Math.random()<0.2){
    const galEv=GALACTIC_EVENTS.find(e=>e.epoch.includes(stage));
    if(galEv) return galEv;
  }
  return null; // null = use normal event
}

function _extResetGame(){
  _lastMegaTurn=0;
  const sp=document.getElementById('social-panel');
  if(sp) sp.innerHTML='<div style="color:var(--text-dim);font-size:10px;text-align:center;padding:8px">Funda el Imperio</div>';
  const gp=document.getElementById('galactic-panel');
  if(gp) gp.innerHTML='<div style="color:var(--text-dim);font-size:10px;text-align:center;padding:8px">Sin contacto aún</div>';
}


document.addEventListener('click',e=>{
  const btn=e.target.closest('.btn,.decision-card');if(!btn||btn.classList.contains('decision-card'))return;
  const c=document.createElement('span'),d=Math.max(btn.clientWidth,btn.clientHeight),r=btn.getBoundingClientRect();
  c.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  c.classList.add('btn-ripple');btn.appendChild(c);c.addEventListener('animationend',()=>c.remove());
});

/* ══════════ INIT ══════════ */
updatePlanet();
updateSelectInfos();
drawShield();
startPlanetLoop();
document.querySelectorAll('select').forEach(s=>s.addEventListener('change',updatePlanet));
