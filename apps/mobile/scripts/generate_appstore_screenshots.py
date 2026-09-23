#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'appstore'
OUT.mkdir(parents=True, exist_ok=True)
ICON = ROOT / 'assets' / 'icon.png'

W, H = 1290, 2796
IPAD_W, IPAD_H = 2048, 2732

BLUE = '#0b65d8'
CYAN = '#27c0ff'
INK = '#102033'
MUTED = '#637287'
BG = '#eaf3fb'
GREEN = '#0caf6f'
YELLOW = '#ffd300'
CARD = '#ffffff'


def font(size, bold=False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def round_rect(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def gradient(size, c1=(248,251,255), c2=(246,250,255)):
    w,h=size
    im=Image.new('RGB',size)
    px=im.load()
    for y in range(h):
        t=y/(h-1)
        for x in range(w):
            r=int(c1[0]+(c2[0]-c1[0])*t); g=int(c1[1]+(c2[1]-c1[1])*t); b=int(c1[2]+(c2[2]-c1[2])*t)
            px[x,y]=(r,g,b)
    return im.convert('RGBA')


def wrapped(draw, text, xy, max_w, fnt, fill, line_gap=10, max_lines=None):
    words=text.split()
    lines=[]; line=''
    for word in words:
        test=(line+' '+word).strip()
        if draw.textbbox((0,0), test, font=fnt)[2] <= max_w or not line:
            line=test
        else:
            lines.append(line); line=word
    if line: lines.append(line)
    if max_lines: lines=lines[:max_lines]
    x,y=xy
    for ln in lines:
        draw.text((x,y), ln, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def shadow_layer(size, box, radius, alpha=38, blur=28):
    layer=Image.new('RGBA', size, (0,0,0,0)); d=ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=(16,32,51,alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def app_header(draw, im, x, y, w, scale=1):
    icon = Image.open(ICON).convert('RGBA').resize((int(98*scale), int(98*scale)), Image.Resampling.LANCZOS)
    im.alpha_composite(icon, (x, y))
    draw.text((x+int(116*scale), y+int(9*scale)), 'ElektroPrice', font=font(int(46*scale), True), fill=INK)
    draw.text((x+int(116*scale), y+int(60*scale)), 'Live electricity prices', font=font(int(26*scale)), fill=MUTED)
    pill=[x+w-int(300*scale), y+int(15*scale), x+w, y+int(76*scale)]
    round_rect(draw, pill, int(30*scale), '#e8fff3', '#baf2d1', int(2*scale))
    draw.text((pill[0]+int(28*scale), pill[1]+int(14*scale)), 'Netherlands ▾', font=font(int(25*scale), True), fill=GREEN)


def phone_frame(base, left, top, width, height, content_fn):
    d=ImageDraw.Draw(base)
    base.alpha_composite(shadow_layer(base.size, [left+8,top+12,left+width+8,top+height+12], 95, 38, 16))
    round_rect(d, [left,top,left+width,top+height], 96, '#f8fbff', '#d9e7f4', 3)
    # dynamic island
    round_rect(d, [left+width//2-115, top+34, left+width//2+115, top+70], 22, '#0b1526')
    content_box=(left+38, top+104, left+width-38, top+height-44)
    clip=Image.new('RGBA',(content_box[2]-content_box[0], content_box[3]-content_box[1]),(248,251,255,255))
    content_fn(clip)
    base.alpha_composite(clip, (content_box[0], content_box[1]))


def ui_home(im):
    d=ImageDraw.Draw(im); w,h=im.size
    app_header(d, im, 14, 14, w-28, 0.58)
    y=112
    # language chips
    x=14
    for lang,active in [('LV',False),('EE',False),('LT',False),('RU',False),('EN',True)]:
        bw=54
        round_rect(d,[x,y,x+bw,y+38],19,'#102033' if active else '#fff', '#dce6f1',1)
        d.text((x+13,y+8),lang,font=font(16,True),fill='#fff' if active else '#405671')
        x+=bw+8
    y+=62
    # price card
    round_rect(d,[14,y,w-14,y+330],32,'#ffffff','#dce6f1',2)
    d.text((44,y+34),'1. PRICE NOW',font=font(25,True),fill='#4b6078')
    d.text((44,y+106),'0.069',font=font(92,True),fill='#06162b')
    d.text((360,y+143),'€/kWh',font=font(36,True),fill='#27445f')
    wrapped(d,'Netherlands price now: € for 1 kWh.',(44,y+220),w-90,font(27), '#294259',8)
    round_rect(d,[44,y+278,w-44,y+320],21,'#d9ffe9')
    d.text((68,y+286),'Good time — electricity is cheap',font=font(21,True),fill='#05603a')
    y+=356
    # cost card
    round_rect(d,[14,y,w-14,y+250],32,'#0b65d8')
    d.text((44,y+32),'2. IF I RUN DRYER NOW',font=font(25,True),fill='#dbeafe')
    d.text((44,y+82),'0.26 €',font=font(80,True),fill='#fff')
    wrapped(d,'Running a 2.5 kW dryer for 1.5 hours now will cost about 0.26 €.',(44,y+166),w-90,font(27),'#eef6ff',8)
    y+=278
    # gauge
    round_rect(d,[14,y,w-14,y+286],32,'#ffffff','#dce6f1',2)
    d.text((44,y+32),'3. PRICE GAUGE',font=font(25,True),fill='#4b6078')
    d.text((44,y+88),'Low',font=font(62,True),fill=INK)
    d.text((44,y+148),'cheaper than usual',font=font(27,True),fill='#52657b')
    # gauge rail
    rail=[44,y+204,w-44,y+237]
    for i in range(rail[0],rail[2]):
        t=(i-rail[0])/(rail[2]-rail[0])
        if t<.33: col=(20,int(184+60*t),106)
        elif t<.66: col=(250,204,21)
        else: col=(239,68,68)
        d.line([(i,rail[1]),(i,rail[3])],fill=col,width=1)
    round_rect(d,rail,18,(0,0,0,0),'#00000022',1)
    round_rect(d,[rail[0]+118,rail[1]-8,rail[0]+128,rail[3]+8],5,INK)
    d.text((44,y+254),'Very low',font=font(20,True),fill='#52657b')
    d.text((w//2-40,y+254),'Normal',font=font(20,True),fill='#52657b')
    d.text((w-158,y+254),'Very high',font=font(20,True),fill='#52657b')


def ui_markets(im):
    d=ImageDraw.Draw(im); w,h=im.size
    app_header(d, im, 14, 14, w-28, 0.58)
    y=140
    round_rect(d,[14,y,w-14,y+1080],34,'#ffffff','#dce6f1',2)
    d.text((44,y+38),'Connected live markets',font=font(39,True),fill=INK)
    wrapped(d,'Choose your Nord Pool area and see the current local electricity price in your currency zone.',(44,y+100),w-88,font(25),MUTED,8)
    zones=[('Latvia','LV'),('Lithuania','LT'),('Estonia','EE'),('Finland','FI'),('Norway','NO1–NO5'),('Sweden','SE1–SE4'),('Denmark','DK1–DK2'),('Netherlands','NL'),('Belgium','BE'),('Austria','AT'),('France','FR'),('Poland','PL')]
    yy=y+205
    for name,code in zones:
        round_rect(d,[44,yy,w-44,yy+62],22,'#f4f8fc','#e0e8f1',1)
        d.text((68,yy+16),name,font=font(23,True),fill=INK)
        d.text((w-170,yy+16),code,font=font(22,True),fill=BLUE)
        yy+=76
    # active state label
    round_rect(d,[44,yy+8,w-44,yy+82],26,'#e8fff3','#baf2d1',2)
    d.text((68,yy+28),'20 live markets connected',font=font(25,True),fill=GREEN)


def ui_savings(im):
    d=ImageDraw.Draw(im); w,h=im.size
    app_header(d, im, 14, 14, w-28, 0.58)
    y=140
    round_rect(d,[14,y,w-14,y+360],34,'#ffffff','#dce6f1',2)
    d.text((44,y+38),'Best times to run dryer',font=font(37,True),fill=INK)
    rows=[('1','22:00 – 23:30','Cheapest upcoming 1.5 hours','0.18 €'),('2','02:15 – 03:45','Low night price window','0.21 €'),('3','13:00 – 14:30','Good daytime option','0.24 €')]
    yy=y+105
    for rank,when,desc,cost in rows:
        round_rect(d,[44,yy,92,yy+48],18,'#e8fff3')
        d.text((61,yy+10),rank,font=font(22,True),fill=GREEN)
        d.text((112,yy),when,font=font(31,True),fill=INK)
        d.text((112,yy+38),desc,font=font(21),fill=MUTED)
        round_rect(d,[w-156,yy+10,w-56,yy+50],16,'#effaf3')
        d.text((w-136,yy+20),cost,font=font(19,True),fill='#067647')
        yy+=78
    y+=395
    round_rect(d,[14,y,w-14,y+460],34,'#ffffff','#dce6f1',2)
    d.text((44,y+38),'Price picture',font=font(37,True),fill=INK)
    d.text((44,y+86),'Today and upcoming hours at a glance',font=font(23),fill=MUTED)
    chart=[.52,.44,.39,.34,.28,.24,.31,.43,.62,.71,.66,.53,.42,.35,.30,.27,.32,.45,.56,.49,.37,.29,.25,.23]
    basey=y+380; left=64; bw=(w-128)/len(chart)-3
    for i,val in enumerate(chart):
        x=left+i*(bw+3); bh=230*val
        col='#2dd47a' if val<.32 else ('#54b6ff' if val<.54 else '#ff6868')
        round_rect(d,[x,basey-bh,x+bw,basey],6,col)
    d.text((64,y+405),'00',font=font(16,True),fill=MUTED)
    d.text((w//2-18,y+405),'12',font=font(16,True),fill=INK)
    d.text((w-92,y+405),'24',font=font(16,True),fill=MUTED)


def make_store_image(name, title, subtitle, ui_fn, size=(W,H)):
    w,h=size
    im=gradient(size)
    d=ImageDraw.Draw(im)
    # background brand blobs
    # Clean, non-foggy App Store artwork: crisp flat background with solid brand accents.
    accent=Image.new('RGBA',size,(0,0,0,0)); ad=ImageDraw.Draw(accent)
    ad.rectangle([0,0,w,22], fill=(11,101,216,255))
    ad.rounded_rectangle([w-390,76,w-90,96], radius=10, fill=(39,192,255,210))
    ad.rounded_rectangle([90,h-145,w-90,h-125], radius=10, fill=(11,101,216,170))
    im=Image.alpha_composite(im, accent)
    d=ImageDraw.Draw(im)
    d.text((90,92),title,font=font(78,True),fill=INK)
    wrapped(d,subtitle,(94,190),w-188,font(38),MUTED,12,2)
    phone_w=int(w*0.72); phone_h=int(phone_w*2.03)
    left=(w-phone_w)//2; top=470
    phone_frame(im,left,top,phone_w,min(phone_h,h-top-100),ui_fn)
    im.convert('RGB').save(OUT/name, quality=95)


def make_ipad_from_phone(src, name):
    canvas=gradient((IPAD_W,IPAD_H))
    d=ImageDraw.Draw(canvas)
    d.text((130,115),'ElektroPrice',font=font(92,True),fill=INK)
    wrapped(d,'Live electricity prices and cheaper usage times.',(135,230),IPAD_W-270,font(50),MUTED,16,2)
    img=Image.open(OUT/src).convert('RGBA')
    # crop phone content area lower, paste two panels
    resized=img.resize((1010,2185), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized,(80,470))
    # right info card
    round_rect(d,[1120,520,1930,1110],60,'#ffffff','#dce6f1',3)
    d.text((1180,590),'See price now',font=font(64,True),fill=INK)
    wrapped(d,'Check live €/kWh prices for connected Nord Pool markets.',(1180,690),660,font(38),MUTED,12,4)
    round_rect(d,[1180,910,1830,1018],54,'#0b65d8')
    d.text((1240,938),'Open ElektroPrice',font=font(42,True),fill='#fff')
    round_rect(d,[1120,1190,1930,1840],60,'#ffffff','#dce6f1',3)
    d.text((1180,1260),'Plan cheaper use',font=font(64,True),fill=INK)
    wrapped(d,'Find the lowest upcoming hours for appliances like a dryer.',(1180,1360),660,font(38),MUTED,12,4)
    icon=Image.open(ICON).convert('RGBA').resize((250,250), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon,(1385,1540))
    canvas.convert('RGB').save(OUT/name, quality=95)

make_store_image('iphone_01_price.png','Live power prices','See the current local electricity price instantly.',ui_home)
make_store_image('iphone_02_markets.png','Connected markets','Nord Pool areas across the Baltics, Nordics and Europe.',ui_markets)
make_store_image('iphone_03_savings.png','Use power smarter','Find cheaper hours and estimate appliance cost.',ui_savings)
make_ipad_from_phone('iphone_01_price.png','ipad_01_overview.png')
make_ipad_from_phone('iphone_03_savings.png','ipad_02_savings.png')
for p in sorted(OUT.glob('*.png')):
    im=Image.open(p)
    print(p, im.size, p.stat().st_size)
