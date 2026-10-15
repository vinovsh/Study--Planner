"""Reject oversized mascot bitmaps and artwork spilling over planner controls."""
import pathlib,re,subprocess,time,xml.etree.ElementTree as ET
from PIL import Image
out=pathlib.Path('smoke-results');out.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def bounds(label):
    end=time.time()+20
    while time.time()<end:
        adb('shell','uiautomator','dump','/sdcard/layout-ui.xml')
        xml=adb('shell','cat','/sdcard/layout-ui.xml');(out/'layout-ui.xml').write_text(xml)
        for n in ET.fromstring(xml).iter('node'):
            if n.get('content-desc')==label:
                b=list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]:return b
        time.sleep(.5)
    raise AssertionError('Missing image layout node: '+label)
try:
    adb('install','-r','artifacts/StudyBloom.apk')
    adb('shell','settings','put','global','animator_duration_scale','0')
    for name,size,density in [('standard','1080x1920','420'),('compact','720x1280','320')]:
        adb('shell','wm','size',size);adb('shell','wm','density',density)
        adb('shell','am','force-stop','com.studybloom')
        adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(4)
        x1,y1,x2,y2=bounds('Happy Bookworm mascot')
        path=out/('layout-'+name+'.png')
        with path.open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
        image=Image.open(path).convert('RGB');w,h=image.size
        assert 0<=x1<x2<=w and 0<=y1<y2<h*.6,(name,'out of hero area',(x1,y1,x2,y2))
        assert .35*w<x2-x1<.8*w,(name,'oversized mascot width',x2-x1,w)
        assert .15*h<y2-y1<.42*h,(name,'oversized mascot height',y2-y1,h)
        inside=outside=0
        # Warm cat-fur colors cannot occur in lavender text or sage controls.
        for y in range(75,h-80,2):
            for x in range(0,w,2):
                r,g,b=image.getpixel((x,y))
                if r>1.3*g and b<.9*g and 45<g<205:
                    if x1-10<=x<=x2+10 and y1-10<=y<=y2+10:inside+=1
                    else:outside+=1
        assert inside>150,(name,'mascot not rendered',inside)
        assert outside<100,(name,'mascot spills outside hero',outside)
        print(name,'mascot bounds',(x1,y1,x2,y2),'inside fur',inside,'outside fur',outside)
    (out/'layout-result.txt').write_text('PASS: image bounds and artwork containment at standard and compact Android sizes.\n')
except Exception:
    print((out/'layout-ui.xml').read_text() if (out/'layout-ui.xml').exists() else 'No layout tree')
    raise
finally:
    adb('shell','wm','size','reset');adb('shell','wm','density','reset')
