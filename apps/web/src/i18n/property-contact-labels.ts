import type {AppLocale} from "./config";

const keys = ["heading", "viewContact", "noNumber", "visitorType", "chooseVisitorType", "sharing"] as const;
const labels: Record<AppLocale, readonly string[]> = {
  en: ["Listing contact", "View contact", "No phone number listed", "Which best describes you?", "Choose an option.", "Your details will be shared with the listing contact."],
  es: ["Contacto del anuncio", "Ver contacto", "Sin teléfono publicado", "¿Qué opción te describe mejor?", "Elige una opción.", "Tus datos se compartirán con el contacto del anuncio."],
  fr: ["Contact de l’annonce", "Voir le contact", "Aucun numéro indiqué", "Quelle option vous décrit le mieux ?", "Choisissez une option.", "Vos coordonnées seront transmises au contact de l’annonce."],
  de: ["Kontakt zum Inserat", "Kontakt ansehen", "Keine Telefonnummer angegeben", "Was beschreibt Sie am besten?", "Wählen Sie eine Option.", "Ihre Angaben werden an den Kontakt des Inserats weitergegeben."],
  pt: ["Contacto do anúncio", "Ver contacto", "Sem número de telefone", "Qual opção descreve melhor você?", "Escolha uma opção.", "Os seus dados serão partilhados com o contacto do anúncio."],
  zh: ["房源联系人", "查看联系方式", "未提供电话号码", "哪一项最符合您的身份？", "请选择一项。", "您的信息将分享给房源联系人。"],
  ja: ["物件の連絡先", "連絡先を表示", "電話番号の記載なし", "あなたに最も当てはまるものは？", "選択してください。", "入力内容は物件の連絡先に共有されます。"],
  ar: ["جهة اتصال الإعلان", "عرض جهة الاتصال", "لم يُدرج رقم هاتف", "أي خيار يصفك بشكل أفضل؟", "اختر أحد الخيارات.", "ستتم مشاركة بياناتك مع جهة اتصال الإعلان."],
  hi: ["लिस्टिंग संपर्क", "संपर्क देखें", "फ़ोन नंबर उपलब्ध नहीं है", "आपके लिए कौन-सा विकल्प सही है?", "एक विकल्प चुनें।", "आपकी जानकारी लिस्टिंग संपर्क के साथ साझा की जाएगी।"],
  pa: ["ਲਿਸਟਿੰਗ ਸੰਪਰਕ", "ਸੰਪਰਕ ਵੇਖੋ", "ਫ਼ੋਨ ਨੰਬਰ ਨਹੀਂ ਦਿੱਤਾ ਗਿਆ", "ਤੁਹਾਡੇ ਲਈ ਕਿਹੜਾ ਵਿਕਲਪ ਸਹੀ ਹੈ?", "ਇੱਕ ਵਿਕਲਪ ਚੁਣੋ।", "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਲਿਸਟਿੰਗ ਸੰਪਰਕ ਨਾਲ ਸਾਂਝੀ ਕੀਤੀ ਜਾਵੇਗੀ।"],
  gu: ["લિસ્ટિંગનો સંપર્ક", "સંપર્ક જુઓ", "ફોન નંબર આપ્યો નથી", "કયો વિકલ્પ તમને શ્રેષ્ઠ રીતે વર્ણવે છે?", "એક વિકલ્પ પસંદ કરો.", "તમારી વિગતો લિસ્ટિંગના સંપર્ક સાથે શેર કરવામાં આવશે."],
  ta: ["பட்டியல் தொடர்பு", "தொடர்பைக் காண்க", "தொலைபேசி எண் குறிப்பிடப்படவில்லை", "உங்களுக்குப் பொருத்தமான தேர்வு எது?", "ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும்.", "உங்கள் விவரங்கள் பட்டியலின் தொடர்பு நபருடன் பகிரப்படும்."],
  mr: ["जाहिरातीचा संपर्क", "संपर्क पाहा", "फोन नंबर दिलेला नाही", "कोणता पर्याय तुम्हाला सर्वाधिक लागू होतो?", "एक पर्याय निवडा.", "तुमची माहिती जाहिरातीमधील संपर्क व्यक्तीसोबत शेअर केली जाईल."],
  te: ["లిస్టింగ్ సంప్రదింపు", "సంప్రదింపు చూడండి", "ఫోన్ నంబర్ ఇవ్వలేదు", "మీకు బాగా సరిపోయే ఎంపిక ఏది?", "ఒక ఎంపికను ఎంచుకోండి.", "మీ వివరాలు లిస్టింగ్ సంప్రదింపు వ్యక్తితో పంచుకోబడతాయి."],
  kn: ["ಪಟ್ಟಿಯ ಸಂಪರ್ಕ", "ಸಂಪರ್ಕ ನೋಡಿ", "ದೂರವಾಣಿ ಸಂಖ್ಯೆ ನೀಡಲಾಗಿಲ್ಲ", "ನಿಮಗೆ ಯಾವ ಆಯ್ಕೆ ಹೆಚ್ಚು ಸೂಕ್ತವಾಗಿದೆ?", "ಒಂದು ಆಯ್ಕೆಯನ್ನು ಆರಿಸಿ.", "ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಪಟ್ಟಿಯ ಸಂಪರ್ಕ ವ್ಯಕ್ತಿಯೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಲಾಗುತ್ತದೆ."],
  bn: ["লিস্টিংয়ের যোগাযোগ", "যোগাযোগ দেখুন", "ফোন নম্বর দেওয়া হয়নি", "কোন বিকল্পটি আপনার জন্য সবচেয়ে উপযুক্ত?", "একটি বিকল্প বেছে নিন।", "আপনার তথ্য লিস্টিংয়ের যোগাযোগ ব্যক্তির সঙ্গে শেয়ার করা হবে।"],
};

export function propertyContactLabels(locale: AppLocale) {
  return Object.fromEntries(keys.map((key, index) => [key, labels[locale][index]]));
}
