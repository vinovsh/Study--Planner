"""Exercise separate style popups, cancellation, and persistence on Android."""
import pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('smoke-results');out.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def nodes():
    adb('shell','uiautomator','dump','/sdcard/appearance-ui.xml')
    xml=adb('shell','cat','/sdcard/appearance-ui.xml');(out/'appearance-ui.xml').write_text(xml)
    return list(ET.fromstring(xml).iter('node'))
def bounds(n):return list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
def find(label,scroll=False,edit=False):
    for attempt in range(9 if scroll else 3):
        for n in nodes():
            if edit and n.get('class')!='android.widget.EditText':continue
            if label in (n.get('text'),n.get('content-desc')):
                b=bounds(n)
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]:return n
        if scroll:
            w,h=map(int,re.findall(r'\d+',adb('shell','wm','size'))[-2:]);adb('shell','input','swipe',str(w//2),str(int(h*.75)),str(w//2),str(int(h*.35)),'400')
        time.sleep(.5)
    raise AssertionError('Missing appearance UI: '+label)
def tap(label,scroll=False,edit=False):
    b=bounds(find(label,scroll,edit));adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.5)
def screenshot(name):
    with (out/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def subjects():tap('Home');tap('Subjects',scroll=True)
try:
    adb('shell','settings','put','secure','show_ime_with_hard_keyboard','0')
    adb('shell','am','force-stop','com.studybloom');adb('logcat','-c');adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    subjects();tap('Add a subject',scroll=True);tap('Subject name',edit=True);adb('shell','input','text','Creative%sScience')
    tap('More colors');find('Choose a color');screenshot('10-more-colors-light');tap('Select Peach color');find('New subject')
    tap('More icons');find('Choose an icon');screenshot('11-more-icons-light');tap('Select Science icon');find('Select Science icon')
    # Closing a popup with Android Back must preserve the editor and draft.
    tap('More colors');adb('shell','input','keyevent','4');time.sleep(.5);find('Creative Science',edit=True)
    tap('Save little plan');find('Creative Science',scroll=True)
    # Check both selected styles after a real process restart.
    adb('shell','am','force-stop','com.studybloom');adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    subjects();tap('Creative Science',scroll=True);tap('More colors');assert find('Select Peach color').get('selected')=='true';tap('Close choices')
    tap('More icons');assert find('Select Science icon').get('selected')=='true';tap('Close choices');tap('Close editor')
    tap('Open settings')
    switch=next(n for n in nodes() if n.get('class')=='android.widget.Switch')
    b=bounds(switch);adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.5)
    subjects();tap('Creative Science',scroll=True);tap('More colors');screenshot('12-more-colors-dark');tap('Close choices')
    tap('More icons');screenshot('13-more-icons-dark');tap('Select Music icon');tap('Save little plan')
    logs=adb('logcat','-d');(out/'appearance-logcat.txt').write_text(logs)
    assert not re.search(r'FATAL EXCEPTION|JavascriptException|ReactNativeJS.*(?:TypeError|ReferenceError|Error:)',logs)
    (out/'appearance-result.txt').write_text('PASS: separate color/icon popups, selection, Android Back, draft preservation, save/reload, and light/dark themes.\n')
    print('Subject appearance checks passed')
except Exception:
    screenshot('appearance-failure');(out/'appearance-logcat.txt').write_text(adb('logcat','-d'))
    if (out/'appearance-ui.xml').exists():print((out/'appearance-ui.xml').read_text())
    raise
