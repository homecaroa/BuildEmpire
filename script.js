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

function drawPlanetMirror(){
  const src=document.getElementById('planet-canvas');
  const dst=document.getElementById('game-planet-canvas');
  if(!src||!dst)return;
  const ctx=dst.getContext('2d');
  ctx.clearRect(0,0,dst.width,dst.height);
  ctx.drawImage(src,0,0,src.width,src.height,0,0,dst.width,dst.height);
}

function startPlanetLoop(){
  if(pFrame)cancelAnimationFrame(pFrame);
  function loop(){pAngle++;drawPlanet(readData());drawPlanetMirror();drawHexMap();pFrame=requestAnimationFrame(loop)}
  loop();
}

/* ══════════ SELECT INFO DATABASE ══════════
   Para cada select y cada valor: título, descripción científica, efectos en juego
══════════════════════════════════════════ */
const SELECT_INFO={
  tamano:{
    enano:{title:'Planeta Enano',desc:'Radio ~3400 km, similar a Marte. Gravedad de 