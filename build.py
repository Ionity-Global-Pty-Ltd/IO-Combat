import os
ROOT=os.path.dirname(os.path.abspath(__file__))
import re,sys
svg=open(os.path.join(ROOT,'assets/logo/IONITY_logo_vector.svg')).read()
path=re.search(r'<path[^>]*/>',svg,re.S).group(0)
d=re.search(r'\sd="([^"]+)"',path).group(1); tr=re.search(r'transform="([^"]+)"',path).group(1)
small=f'<path transform="{tr}" fill="#00c6ff" d="{d}"/>'
big=f'<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0ff"/><stop offset="1" stop-color="#1658A4"/></linearGradient></defs><path transform="{tr}" fill="url(#lg)" d="{d}"/>'
src=os.path.join(ROOT,'src/')
html=open(src+'a_head.html').read()+open(src+'b_body.html').read()
for f in ['c1_core.js','c2_fighter.js','c3_world.js','c4_game.js','c5_ui.js']: html+=open(src+f).read()
html=html.replace('{{LOGO_PATH_SPLASH}}',big).replace('{{LOGO_PATH}}',small)
open(os.path.join(ROOT,'index.html'),'w').write(html)
print(len(html))
