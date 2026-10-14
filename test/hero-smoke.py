"""Check the changed hero and its focus shortcut in the standalone offline APK."""
import pathlib, re, subprocess, time, xml.etree.ElementTree as ET

out = pathlib.Path('smoke-results')
out.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, stderr=subprocess.STDOUT)
def ui():
    adb('shell', 'uiautomator', 'dump', '/sdcard/bloom-ui.xml')
    xml = adb('shell', 'cat', '/sdcard/bloom-ui.xml')
    (out/'latest-ui.xml').write_text(xml)
    return list(ET.fromstring(xml).iter('node'))
def find(label, timeout=18):
    end=time.time()+timeout
    while time.time()<end:
        for n in ui():
            if label in n.get('text','') or label in n.get('content-desc',''):
                bounds=list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
                if len(bounds)==4 and bounds[2]>bounds[0] and bounds[3]>bounds[1]:
                    return bounds
        time.sleep(.5)
    raise AssertionError('Missing visible UI: '+label)
def tap(label, hold=False):
    x1,y1,x2,y2=find(label)
    x,y=str((x1+x2)//2),str((y1+y2)//2)
    if hold: adb('shell','input','swipe',x,y,x,y,'750')
    else: adb('shell','input','tap',x,y)
    time.sleep(.8)
def screenshot(label):
    with (out/(label+'.png')).open('wb') as f:
        subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
try:
    adb('install','-r','artifacts/StudyBloom.apk')
    adb('shell','svc','wifi','disable')
    adb('shell','svc','data','disable')
    # Continuous native animation should not hold UI Automator's idle wait open.
    adb('shell','settings','put','global','animator_duration_scale','0')
    adb('logcat','-c')
    adb('shell','am','start','-n','com.studybloom/.MainActivity')
    find('Hi, study buddy!')
    find('Pet your study buddy')
    screenshot('01-reference-hero')
    tap('Pet your study buddy')
    # A persistent quote change confirms onPress without racing a short toast.
    find('You’re doing great!')
    screenshot('02-hero-encouragement')
    tap('Pet your study buddy',hold=True)
    find('Time to bloom 🌸')
    screenshot('03-focus-shortcut')
    tap('Home')
    find('Pet your study buddy')
    # Restore motion and verify the native-driven loop runs without JS errors.
    adb('shell','settings','put','global','animator_duration_scale','1')
    time.sleep(3)
    screenshot('04-animated-hero')
    logs=adb('logcat','-d')
    (out/'logcat.txt').write_text(logs)
    if re.search(r'FATAL EXCEPTION|JavascriptException|ReactNativeJS.*(?:TypeError|ReferenceError|Error:)',logs):
        raise AssertionError('Runtime error')
    (out/'result.txt').write_text('PASS: standalone offline launch, hero pet interaction, long-press focus shortcut, home navigation, native animation startup.\n')
    print('Interactive hero checks passed')
except Exception:
    screenshot('failure')
    (out/'logcat.txt').write_text(adb('logcat','-d'))
    raise
