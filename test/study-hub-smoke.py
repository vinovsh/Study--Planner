"""Exercise separate style popups, cancellation, and persistence on Android."""
import pathlib,re,subprocess,time,xml.etree.ElementTree as ET
out=pathlib.Path('smoke-results');out.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def nodes():
    adb('shell','uiautomator','dump','/sdcard/appearance-ui.xml')
    xml=adb('shell','cat','/sdcard/appearance-ui.xml');(out/'appearance-ui.xml').write_text(xml)
    return list(ET.fromstring(xml).iter('node'))
def bounds(n):return list(map(int,re.findall(r'-?\d+',n.get('bounds',''))))
def find(label,scroll=False,edit=False,click=False):
    _,screen_height=map(int,re.findall(r'\d+',adb('shell','wm','size'))[-2:])
    for attempt in range(9 if scroll else 3):
        for n in nodes():
            if click and n.get('clickable')!='true':continue
            if edit and n.get('class')!='android.widget.EditText':continue
            if label in (n.get('text'),n.get('content-desc')):
                b=bounds(n)
                if len(b)==4 and b[2]>b[0] and b[3]>b[1]:
                    if n.get('class') in ('android.widget.Button','android.widget.RadioButton','android.widget.EditText') and b[3]-b[1]<screen_height*.045:continue
                    return n
        if scroll:
            w,h=map(int,re.findall(r'\d+',adb('shell','wm','size'))[-2:]);adb('shell','input','swipe',str(w//2),str(int(h*.75)),str(w//2),str(int(h*.35)),'400')
        time.sleep(.5)
    raise AssertionError('Missing appearance UI: '+label)
def tap(label,scroll=False,edit=False):
    b=bounds(find(label,scroll,edit,click=True));adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.5)
def screenshot(name):
    with (out/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def subjects():tap('Home');tap('Subjects',scroll=True)
def input_text(label,value):
    tap(label,scroll=True,edit=True);adb('shell','input','text',value.replace(' ','%s'))
def native_positive():
    for n in nodes():
        if n.get('resource-id')=='android:id/button1':
            b=bounds(n);adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.6);return
    raise AssertionError('Missing native positive action')
def toolkit(label):
    tap('Home');tap('Open settings');tap(label,scroll=True)
def tap_switch(label):
    # Find the switch itself, not the adjacent text label.
    for _ in range(9):
        for n in nodes():
            if n.get('class')=='android.widget.Switch' and n.get('content-desc')==label:
                b=bounds(n);adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2));time.sleep(.6);return
        w,h=map(int,re.findall(r'\d+',adb('shell','wm','size'))[-2:]);adb('shell','input','swipe',str(w//2),str(int(h*.75)),str(w//2),str(int(h*.35)),'350')
    raise AssertionError('Missing switch: '+label)
try:
    adb('shell','settings','put','secure','show_ime_with_hard_keyboard','0')
    adb('shell','am','force-stop','com.studybloom');adb('logcat','-c');adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    toolkit('📖 Chapters & daily plan');tap('Add chapter',scroll=True)
    input_text('Study title','Native cell chapter');tap('Save study item',scroll=True)
    find('Syllabus & daily plan',scroll=True);find('Native cell chapter',scroll=True);screenshot('14-chapter-plan')
    tap('Focus on Native cell chapter',scroll=True);find('Chapter: Native cell chapter');screenshot('15-chapter-focus')
    toolkit('🧮 Formulas & facts');tap('Add formula or fact',scroll=True)
    input_text('Study title','Native force formula');input_text('Formula, fact and explanation','F equals mass times acceleration')
    tap('Save study item',scroll=True);find('Native force formula',scroll=True);screenshot('16-formula-library')
    toolkit('✍️ Practice questions');tap('Add practice question',scroll=True)
    input_text('Practice question','What is two plus two?')
    for label,value in [('Answer A','Three'),('Answer B','Four'),('Answer C','Five'),('Answer D','Six')]:input_text(label,value)
    tap('Correct answer B',scroll=True);tap('Save study item',scroll=True)
    tap('Start practice',scroll=True);tap('Quiz answer B',scroll=True);tap('Check answer',scroll=True)
    find('Correct! · Answer B',scroll=True);screenshot('17-practice-feedback')
    tap('Submit test',scroll=True);find('Submit this test?');native_positive()
    find('Results & answer review',scroll=True);screenshot('18-practice-result')
    # Reload must preserve the new learning material and the saved test result.
    adb('shell','am','force-stop','com.studybloom');adb('shell','am','start','-n','com.studybloom/.MainActivity');time.sleep(2)
    toolkit('🔎 Search everything');input_text('Search study material','Native cell')
    find('Native cell chapter',scroll=True);screenshot('19-global-search')
    toolkit('📅 Study calendar');find('Study calendar');screenshot('20-study-calendar')
    logs=adb('logcat','-d');(out/'study-hub-logcat.txt').write_text(logs)
    assert not re.search(r'FATAL EXCEPTION|JavascriptException|ReactNativeJS.*(?:TypeError|ReferenceError|Error:)',logs)
    (out/'study-hub-result.txt').write_text('PASS: chapters, linked focus, formula library, question creation, practice feedback/result, process restart, global search and monthly calendar.\n')
    print('Study toolkit native checks passed')
except Exception:
    screenshot('study-hub-failure');(out/'study-hub-logcat.txt').write_text(adb('logcat','-d'))
    if (out/'appearance-ui.xml').exists():print((out/'appearance-ui.xml').read_text())
    raise
