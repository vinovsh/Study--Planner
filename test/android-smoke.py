"""Exercise the bundled APK with Wi-Fi/data off, using Android UI Automator."""
import subprocess, time, re, pathlib, xml.etree.ElementTree as ET

out = pathlib.Path('smoke-results')
out.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, stderr=subprocess.STDOUT)
def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/bloom-ui.xml')
    xml = adb('shell', 'cat', '/sdcard/bloom-ui.xml')
    (out/'latest-ui.xml').write_text(xml)
    return list(ET.fromstring(xml).iter('node'))
def find(text, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for node in nodes():
            if text == node.get('text') or text == node.get('content-desc'):
                return node
        time.sleep(.5)
    raise AssertionError('UI element not found: ' + text)
def tap(text):
    n = find(text)
    a,b,c,d = map(int, re.findall(r'\d+', n.get('bounds')))
    adb('shell', 'input', 'tap', str((a+c)//2), str((b+d)//2))
    time.sleep(.7)
def enter(label, text):
    tap(label)
    adb('shell', 'input', 'text', text.replace(' ', '%s'))
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(.5)
def screenshot(name):
    with (out/(name+'.png')).open('wb') as f:
        subprocess.run(['adb','exec-out','screencap','-p'], stdout=f, check=True)
def scroll():
    adb('shell','input','swipe','500','1500','500','500','350')
    time.sleep(.7)
def launch():
    adb('shell','am','start','-n','com.studybloom/.MainActivity')
    time.sleep(3)

try:
    adb('install','-r','artifacts/StudyBloom.apk')
    adb('shell','svc','wifi','disable')
    adb('shell','svc','data','disable')
    adb('logcat','-c')
    launch()
    find('Hi, study buddy!')
    screenshot('01-home')
    scroll()
    tap('Complete Read Chapter 4')
    tap('Planner')
    tap('Home')
    find('1/3')
    tap('Planner')
    find('Your week 🌱')
    screenshot('02-planner')
    tap('Focus')
    find('Time to bloom 🌸')
    screenshot('04-focus')
    tap('▶ Start focus')
    tap('Ⅱ Pause')
    find('▶ Resume')
    adb('shell','am','force-stop','com.studybloom')
    launch()
    find('1/3')
    tap('Focus')
    find('▶ Resume')
    tap('Home')
    scroll()
    tap('Subjects')
    find('My subjects 🌸')
    screenshot('03-subjects')
    scroll()
    tap('Add a subject')
    enter('Subject name','Chemistry')
    tap('Save little plan')
    # Return home via the bottom tab rather than depending on scroll position.
    tap('Home')
    scroll()
    tap('Flashcards')
    find('Little lessons 🌸')
    screenshot('05-flashcards')
    tap('Flip flashcard')
    screenshot('05-flashcard-answer')
    tap('✓ Got it')
    tap('Progress')
    find('Look how you grew! 🌷')
    screenshot('06-progress')
    logs = adb('logcat','-d')
    (out/'logcat.txt').write_text(logs)
    if re.search(r'FATAL EXCEPTION|JavascriptException|ReactNativeJS.*(?:TypeError|ReferenceError|Error:)',logs):
        raise AssertionError('Runtime error in Android logs')
    (out/'result.txt').write_text('PASS: offline launch, task completion, timer pause persistence, subjects, flashcards, progress; six screenshots captured.\n')
    print('Android offline smoke checks passed')
except Exception:
    screenshot('failure')
    (out/'logcat.txt').write_text(adb('logcat','-d'))
    raise
