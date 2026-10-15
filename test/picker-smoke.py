"""Verify actual Android calendar/clock dialogs, cancellation, and saved values."""
import pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('smoke-results');out.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def nodes():
    adb('shell','uiautomator','dump','/sdcard/picker-ui.xml')
    xml=adb('shell','cat','/sdcard/picker-ui.xml');(out/'picker-ui.xml').write_text(xml)
    return list(ET.fromstring(xml).iter('node'))
def find(value,by_id=False,timeout=15):
    end=time.time()+timeout
    while time.time()<end:
        for n in nodes():
            match=n.get('resource-id')==value if by_id else value in (n.get('text'),n.get('content-desc'))
            if match:
                b=list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]:return b
        time.sleep(.4)
    raise AssertionError('Picker UI not found: '+value)
def tap(value,by_id=False):
    x1,y1,x2,y2=find(value,by_id);adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.6)
def screenshot(name):
    with (out/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def input_text(value,text,by_id=False):
    tap(value,by_id);adb('shell','input','keyevent','123')
    for _ in range(5):adb('shell','input','keyevent','67')
    adb('shell','input','text',text.replace(' ','%s'))
def hide_keyboard():
    # Emulators can have a hardware keyboard: Back would close the editor/dialog.
    state=adb('shell','dumpsys','input_method')
    if 'mIsInputViewShown=true' in state or ('mIsInputViewShown' not in state and 'mImeWindowVis=0x3' in state):
        adb('shell','input','keyevent','4');time.sleep(.5)
def set_clock(hour,minute):
    find('android:id/radial_picker',True)
    # Start in clock mode, then use Android's built-in keyboard toggle for exact test values.
    tap('android:id/toggle_mode',True)
    input_text('android:id/input_hour',hour,True)
    input_text('android:id/input_minute',minute,True)
    hide_keyboard();tap('android:id/button1',True)
try:
    adb('shell','am','force-stop','com.studybloom');adb('logcat','-c')
    adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    tap('Planner');tap('Add');input_text('Title','Picker practice');hide_keyboard()
    find('New session')
    tap('Choose date');find('android:id/datePicker',True);screenshot('05-calendar-picker')
    tap('android:id/button2',True);find('Choose date')
    tap('Choose date');tap('android:id/button1',True)
    tap('Choose start time');find('android:id/radial_picker',True);screenshot('06-start-clock')
    set_clock('10','45');find('10:45 AM')
    tap('Choose duration');find('android:id/radial_picker',True);screenshot('07-duration-clock')
    set_clock('1','15');find('1 hr 15 min');screenshot('08-picker-values')
    tap('Save little plan');find('Picker practice · 75 min');find('10:45')
    adb('shell','am','force-stop','com.studybloom');adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    tap('Planner');find('Picker practice · 75 min');find('10:45');screenshot('09-saved-session')
    logs=adb('logcat','-d');(out/'picker-logcat.txt').write_text(logs)
    if re.search(r'FATAL EXCEPTION|JavascriptException|ReactNativeJS.*(?:TypeError|ReferenceError|Error:)',logs):raise AssertionError('Picker runtime error')
    (out/'picker-result.txt').write_text('PASS: native date picker, cancel, hour/minute clock, duration clock, and saved/reloaded session values.\n')
    print('Native picker checks passed')
except Exception:
    screenshot('picker-failure');(out/'picker-logcat.txt').write_text(adb('logcat','-d'))
    if (out/'picker-ui.xml').exists():print((out/'picker-ui.xml').read_text())
    raise
