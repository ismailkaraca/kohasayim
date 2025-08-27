import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, LineChart, Line } from 'recharts';
import * as Tone from 'tone';

// --- Custom Hooks & Libraries ---
// Custom hook to dynamically load external scripts
const useScript = (url, globalVarName) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    // Check if the script's global variable already exists
    if (window[globalVarName]) {
      setIsReady(true);
      return;
    }
    let script = document.querySelector(`script[src="${url}"]`);
    const handleLoad = () => setIsReady(true);
    const handleError = () => console.error(`Error loading script: ${url}`);

    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      document.body.appendChild(script);
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
    } else {
        script.addEventListener('load', handleLoad);
        script.addEventListener('error', handleError);
    }
    // Cleanup function to remove event listeners
    return () => { if (script && script.parentElement) { script.removeEventListener('load', handleLoad); script.removeEventListener('error', handleError); } };
  }, [url, globalVarName]);
  return isReady;
};


// --- Robust Barcode Scanner Component ---
// This component handles the camera-based barcode scanning functionality.
const RobustBarcodeScanner = ({ onScan, onClose, isPaused }) => {
    const readerId = "robust-barcode-scanner";
    const [message, setMessage] = useState({ text: 'Kamera başlatılıyor...', type: 'info' });
    const scannerRef = useRef(null);
    const throttleTimeoutRef = useRef(null); // To prevent rapid re-scans of the same code
    const scannedCodesThisSessionRef = useRef(new Set()); // Tracks codes scanned only while camera is open

    // Clean up the timer when the component is unmounted
    useEffect(() => {
        return () => {
            if (throttleTimeoutRef.current) {
                clearTimeout(throttleTimeoutRef.current);
            }
        };
    }, []);
    
    // Handles the result of a successful scan
    const handleScanResult = (decodedText) => {
        // Stop if paused (e.g., a modal is open) or if we are in a throttle cooldown
        if (isPaused || throttleTimeoutRef.current) {
            return;
        }

        // Check if this barcode has already been scanned in the current camera session
        if (scannedCodesThisSessionRef.current.has(decodedText)) {
            setMessage({ text: 'Bu barkod bu oturumda zaten okutuldu.', type: 'warning' });
            return;
        }

        const scanResult = onScan(decodedText); // Pass the barcode to the main app for processing

        // The main app returns an object. If it's an ISBN, we show a message but don't throttle.
        if (scanResult.outcome === 'isbn') {
            setMessage({ text: 'ISBN algılandı. Lütfen demirbaş barkodunu okutun.', type: 'warning' });
            // We don't add to scannedCodesThisSessionRef and don't throttle, allowing immediate re-scan
            return;
        }
        
        scannedCodesThisSessionRef.current.add(decodedText);
        setMessage({ text: `Başarılı: ${decodedText}`, type: 'success' });
        
        // Start a cooldown period to prevent re-scanning the same code immediately
        throttleTimeoutRef.current = setTimeout(() => {
            throttleTimeoutRef.current = null;
        }, 2000); // 2-second cooldown
    };

    useEffect(() => {
        if (!window.Html5Qrcode) {
             setMessage({ text: 'Tarayıcı kütüphanesi yüklenemedi.', type: 'error' });
            return;
        }

        const html5QrCode = new window.Html5Qrcode(readerId);
        scannerRef.current = html5QrCode;

        const startCamera = async () => {
            try {
                 setMessage({ text: 'Kamera başlatılıyor, lütfen bekleyin...', type: 'info' });
                await html5QrCode.start(
                    { facingMode: "environment" }, // Use the rear camera
                    { fps: 10, qrbox: { width: 250, height: 250 } }, // Scanner configuration
                    handleScanResult,
                    (errorMessage) => { /* Non-critical scan errors can be ignored */ }
                );
                 setMessage({ text: 'Okutmak için kamerayı barkoda yaklaştırın.', type: 'info' });
            } catch (err) {
                console.error("Kamera başlatma hatası:", err);
                if (err.name === 'NotAllowedError') {
                    setMessage({ text: 'Lütfen kamera erişimine izin verin.', type: 'error' });
                } else {
                    setMessage({ text: 'Kamera başlatılamadı.', type: 'error' });
                }
            }
        };

        startCamera();

        // Cleanup function to stop the camera when the component unmounts
        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Kamera durdurulurken hata oluştu:", err));
            }
        };
    }, [onScan, isPaused]);

    // Determines the style of the message box based on the message type
    const getMessageStyles = (type) => {
        switch (type) {
            case 'success': return 'bg-green-100 border-green-500 text-green-800';
            case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
            case 'error': return 'bg-red-100 border-red-500 text-red-800';
            default: return 'bg-blue-100 border-blue-500 text-blue-800';
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-40 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg overflow-hidden shadow-2xl">
                 <div id={readerId} />
                 <div
                    role="alert"
                    className={`p-4 text-center font-semibold border-t-4 ${getMessageStyles(message.type)}`}
                >
                    {message.text}
                </div>
            </div>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-700 text-white rounded-md font-bold hover:bg-slate-800">Kamerayı Kapat</button>
        </div>
    );
};


// --- Data Constants & Icons ---
// Initial data for libraries and locations, and definitions for warnings and icons.
const INITIAL_LIBRARIES = [
  ["12", "ADANA  İL HALK KÜTÜPHANESİ"]
];
const INITIAL_LOCATIONS = [
    ["YB", "Yetişkin Bölümü"]	,
["ÇB", "Çocuk Bölümü"]
];
const WARNING_DEFINITIONS = { 
    invalidStructure: { id: 'invalidStructure', text: 'Yapıya Uygun Olmayan', color: '#E74C3C', sound: 'A#3', message: 'Okutulan barkod gerekli yapıyla eşleşmiyor.' }, 
    locationMismatch: { id: 'locationMismatch', text: 'Konum Farklı', color: '#FAD7A0', sound: 'C4', message: 'Okutulan materyal seçilen lokasyonda bulunmuyor.' }, 
    notLoanable: { id: 'notLoanable', text: 'Ödünç Verilemez', color: '#F08080', sound: 'E5', message: "Materyalin ödünç verilebilirlik durumu uygun değil." }, 
    notInCollection: { id: 'notInCollection', text: 'Düşüm/Devir', color: '#A9C9F5', sound: 'G4', message: 'Materyal koleksiyonda değil (düşüm veya devir yapılmış).' }, 
    onLoan: { id: 'onLoan', text: 'Okuyucuda', color: '#F7B38D', sound: 'C4', message: 'Materyal şu anda ödünçte ve iade edilmesi gerekiyor.' }, 
    wrongLibrary: { id: 'wrongLibrary', text: 'Farklı Kütüphane', color: '#C7AED9', sound: 'C4', message: 'Materyal sizin kütüphanenize ait değil.' }, 
    deleted: { id: 'deleted', text: 'Listede Yok', color: '#808080', sound: 'A3', message: 'Barkod formatı doğru ancak içeri aktarılan listede bulunamadı. (muhtemelen silinmiş materyal olabilir)' }, 
    autoCompletedNotFound: { id: 'autoCompletedNotFound', text: 'Manuel Girilen Bulunamadı', color: '#8E44AD', sound: 'A3', message: 'Barkod 12 haneye tamamlandı ancak içeri aktardığınız listede bulunamadı. Lütfen materyal barkodunu kontrol edin.' }, 
    duplicate: { id: 'duplicate', text: 'Tekrar Okutuldu', color: '#FFC300', sound: 'B4', message: 'Bu barkod daha önce okutuldu.'},
    isbnDetected: { id: 'isbnDetected', text: 'ISBN Algılandı', color: '#E67E22', sound: 'F#4', message: 'Okutulan barkod bir ISBN olabilir. Lütfen materyalin üzerindeki demirbaş barkodunu okutun.' }
};
const PIE_CHART_COLORS = { valid: '#2ECC71', invalid: '#E74C3C', missing: '#95A5A6' };
const ICONS = {
    download: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    writeOff: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9.5 14.5 5-5"/><path d="m14.5 14.5-5-5"/></svg>,
    missing: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>,
    all: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
    clean: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    wrongLib: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41c.39.39.59.9.59 1.41v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h7.59c.51 0 1.02.2 1.41.59l4.59 4.59c.39.39.59.9.59 1.41z"/><path d="M12 3v10l-4-2-4 2V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/></svg>,
    location: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
    notLoanable: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
    status: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.6v-2.1c0-2.8 2.2-5 5-5h11"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.4v2.1c0 2.8-2.2 5-5 5H5"/></svg>,
    onLoan: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><circle cx="12" cy="8" r="2"/><path d="M15 13a3 3 0 1 0-6 0"/></svg>,
    soundOn: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
    soundOff: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><line x1="15" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="15" y2="15"/></svg>,
    share: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
    install: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>,
};

// --- Mappings for Report Generation ---
const MATERIAL_STATUS_MAP = {
    '0': 'Eser Koleksiyonda', '1': 'Düşüm Yapıldı', '2': 'Devir Yapıldı',
};
const LOAN_ELIGIBILITY_MAP = {
    '0': 'Ödünç Verilebilir', '1': 'Ödünç Verilemez- Diğer', '2': 'Ödünç Verilemez- Danışma Kaynağı',
    '3': 'Ödünç Verilemez- Kayıp', '4': 'Ödünç Verilemez- Yıpranmış', '5': 'Ödünç Verilemez- Derleme',
    '6': 'Ödünç Verilemez- Nadir Eser', '7': 'Ödünç Verilemez- Düşüm', '8': 'Ödünç Verilemez- Devir',
    '9': 'Ödünç Verilemez- KHK', '10': 'Ödünç Verilemez- Kullanıcı Şikayeti', '11': 'Ödünç Verilemez- Süreli Yayın',
};
const LOCATION_CODE_MAP = {
    'AB': 'Atatürk Bölümü', 'AÖÖK': 'Adnan Ötüken Özel Koleksiyonu (Adnan Ötüken İl Halk İçin)',
    'Bakanlık Yayınları': 'Bakanlık Yayınları (Edebiyat Müze Kütüphaneleri İçin)', 'BB': 'Bebek Bölümü (0-3 Yaş)',
    'BEYRA': 'Rami Yerleşkesi', 'D': 'Depo', 'DB': 'Danışma Bölümü', 'DG': 'Diğer',
    'Edebiyat Kuramı': 'Edebiyat Kuramı (Edebiyat Müze Kütüphaneleri İçin)', 'EK': 'Etkinlik Kitapları Bölümü',
    'GAY': 'Gezici Kütüphane Anadolu Yakası', 'GB': 'Gençlik Bölümü', 'GD1': 'Geçici Derme1',
    'GD2': 'Geçici Derme2', 'GD3': 'Geçici Derme3', 'GD4': 'Geçici Derme4 (Kurumlar)',
    'Gİ': 'Gör-İşit Bölümü', 'GK': 'Gezici Kütüphane', 'GK2': 'Gezici Kütüphane 2',
    'IOK': 'İlk Okuma Kitapları Bölümü', 'İmzalı Kitaplar': 'İmzalı Kitaplar (Edebiyat Müze Kütüphaneleri İçin)',
    'KB': 'Kataloglama Bölümü', 'KK': 'Kent Kitaplığı', 'KOK': 'Osmaniye Fakıuşağı Konteyner Kent',
    'NE': 'Nadir Eserler Bölümü', 'NÖ': 'Nobel Ödüllü Kitaplar', 'OÖ': 'Okul Öncesi Bölümü',
    'RA1': 'Atatürk İhtisas (Rami Kütüphanesi)', 'RA10': 'Toplum Bilimleri: 142 (Rami Kütüphanesi)',
    'RA11': 'Dil ve Dil Bilimi: 163 (Rami Kütüphanesi)', 'RA12': 'Doğa Bilimleri ve Matematik: 141 (Rami Kütüphanesi)',
    'RA13': 'Teknoloji ve Uygulamalı Bilimler: 150 (Rami Kütüphanesi)', 'RA14': 'Güzel Sanatlar: 153 (Rami Kütüphanesi)',
    'RA15': 'Edebiyat & Retorik: 154/155 (Rami Kütüphanesi)', 'RA16': 'Tarih & Coğrafya: 168 (Rami Kütüphanesi)',
    'RA18': 'İlk Öğretim Çalışma Salonu (10-14 yaş): 125 (Rami Kütüphanesi)', 'RA19': 'Atatürk İhtisas: 114 (Rami Kütüphanesi)',
    'RA2': 'İlk Öğretim Çalışma Salonu (6-9 yaş): 124 (Rami Kütüphanesi)', 'RA20': 'Atatürk İhtisas: 115 (Rami Kütüphanesi)',
    'RA21': 'Biyografi Kitaplığı: 118 (Rami Kütüphanesi)', 'RA22': 'Günay-Turgut Kut İhtisas Kitaplığı (Yazma Eserler Okuma Salonu): 177 (Rami Kütüphanesi)',
    'RA23': 'Engelsiz Bilgi Merkezi: 148 (Rami Kütüphanesi)', 'RA3': 'Bebek Kütüphanesi (Masal 0-3 yaş): 126/127 (Rami Kütüphanesi)',
    'RA4': 'Lise Hazırlık: 129/130 (Rami Kütüphanesi)', 'RA5': 'Üniversite Hazırlık: 134 (Rami Kütüphanesi)',
    'RA7': 'Genel Konular: 156 (Rami Kütüphanesi)', 'RA8': 'Psikoloji ve Felsefe: 139 (Rami Kütüphanesi)',
    'RA9': 'Din: 146 (Rami Kütüphanesi)', 'S': 'Salon', 'SAM': 'Şehir Araştırmaları Merkezi',
    'SB': 'Sanat Bölümü', 'SY': 'Süreli Yayınlar Bölümü', 'TEDA Kitapları': 'TEDA Kitapları',
    'Türk Edebiyatı': 'Türk Edebiyatı (Edebiyat Müze Kütüphaneleri İçin)', 'YB': 'Yetişkin Bölümü',
    'YC': 'Yetişkin Cep (Adnan Ötüken İl Halk İçin)', 'YDB': 'Yabancı Diller Bölümü', 'ZBB': 'Ziya Bey Bölümü',
    'ÇB': 'Çocuk Bölümü', 'Ödüllü Kitaplar - Dünya Edebiyatı': 'Ödüllü Kitaplar - Dünya Edebiyatı (Edebiyat Müze Kütüphaneleri İçin)',
    'Ödüllü Kitaplar - Türk Edebiyatı': 'Ödüllü Kitaplar - Türk Edebiyatı (Edebiyat Müze Kütüphaneleri İçin)', 'ÖK': 'Özel Koleksiyon',
};

// --- Utilities & Components ---
// A collection of reusable components and utility functions used throughout the application.
const synth = new Tone.Synth().toDestination();
const CustomTooltip = ({ active, payload, label }) => { if (active && payload && payload.length) { return <div className="bg-white p-2 border border-gray-300 rounded shadow-lg"><p className="font-bold text-slate-800">{label}</p><p className="text-sm text-slate-600">{`Sayı: ${payload[0].value}`}</p></div>; } return null; };
const FileUploader = ({ onFileAccepted, children, title, disabled, accept }) => { const onDrop = useCallback(acceptedFiles => { onFileAccepted(acceptedFiles[0]); }, [onFileAccepted]); const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, disabled, accept }); return <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${disabled ? 'bg-slate-100 text-slate-400' : 'cursor-pointer'} ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}><input {...getInputProps()} /><p className="text-slate-500">{title}</p>{children}</div>; };
const Modal = ({ isOpen, onClose, children }) => { if (!isOpen) return null; return <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"><div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto">{children}</div></div>; };
const WarningModal = ({ isOpen, onClose, title, warnings, barcode }) => { const [isCopied, setIsCopied] = useState(false); const handleCopy = (text) => { const textArea = document.createElement("textarea"); textArea.value = text; textArea.style.position = "fixed"; document.body.appendChild(textArea); textArea.focus(); textArea.select(); try { document.execCommand('copy'); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); } catch (err) { console.error("Panoya kopyalanamadı: ", err); } document.body.removeChild(textArea); }; const onLoanWarning = warnings.find(w => w.id === 'onLoan'); return <Modal isOpen={isOpen} onClose={onClose}><div className="flex justify-between items-center p-4 border-b"><h3 className="text-lg font-bold text-slate-800">{title}</h3><button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">&times;</button></div><div className="p-5"><ul className="space-y-2 list-disc list-inside">{warnings.map(w => <li key={w.id} style={{color: w.color}} className="font-semibold">{w.message || w.text}</li>)}</ul>{onLoanWarning && barcode && <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-200"><p className="text-sm font-medium text-slate-800">Bu materyali Koha'da iade almak için:</p><a href={`https://personel.ekutuphane.gov.tr/cgi-bin/koha/circ/returns.pl`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold block mt-2 hover:text-blue-800">Koha İade Sayfasına Git</a><p className="text-xs text-slate-500 mt-1">İade sayfasını açtıktan sonra aşağıdaki barkodu yapıştırabilirsiniz.</p><div className="mt-3 flex items-center gap-2"><input type="text" readOnly value={barcode} className="w-full p-2 border bg-slate-200 rounded-md font-mono text-sm" /><button onClick={() => handleCopy(barcode)} className={`px-4 py-2 rounded-md text-white font-semibold transition-colors ${isCopied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}>{isCopied ? 'Kopyalandı!' : 'Barkodu Kopyala'}</button></div></div>}<button onClick={onClose} className="mt-6 bg-slate-600 text-white py-2 px-4 rounded hover:bg-slate-700 w-full font-bold">Tamam</button></div></Modal>; };
const ConfirmationModal = ({ isOpen, onClose, message, onConfirm }) => { if (!isOpen) return null; const handleConfirm = () => { onConfirm(); onClose(); }; return <Modal isOpen={isOpen} onClose={onClose}><div className="p-6 text-center"><h3 className="text-lg font-medium text-slate-800 mb-4">{message}</h3><div className="flex justify-center gap-4"><button onClick={onClose} className="px-6 py-2 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 font-semibold">Hayır</button><button onClick={handleConfirm} className="px-6 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 font-semibold">Evet, Sil</button></div></div></Modal>; };
const AddDataModal = ({ isOpen, onClose, onAdd, type }) => { const [code, setCode] = useState(''); const [name, setName] = useState(''); const handleAdd = () => { if(code && name) { onAdd(type, code, name); onClose(); setCode(''); setName(''); } }; return <Modal isOpen={isOpen} onClose={onClose}><div className="p-5"><h3 className="text-lg font-bold mb-4">Yeni {type === 'library' ? 'Kütüphane' : 'Lokasyon'} Ekle</h3><div className="space-y-4"><input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Kod" className="w-full p-2 border border-slate-300 rounded-md" /><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="İsim" className="w-full p-2 border border-slate-300 rounded-md" /></div><div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-200">İptal</button><button onClick={handleAdd} className="px-4 py-2 rounded-md bg-blue-600 text-white">Ekle</button></div></div></Modal>; };

// Helper function to transform report data by replacing codes with descriptions
const transformReportData = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(originalItem => {
        if (!originalItem) return {}; // Handle null/undefined items in data array
        const item = { ...originalItem };
        
        // Explicitly map to new keys and transform values
        const transformedItem = {
            ...item, // Copy all original properties first
            'Materyal Statüsü': MATERIAL_STATUS_MAP[item['materyal_statusu_kodu']] || item['materyal_statusu_kodu'],
            'Ödünç Verilebilirlik': LOAN_ELIGIBILITY_MAP[item['odunc_verilebilirlik_kodu']] || item['odunc_verilebilirlik_kodu'],
            'Materyalin Yeri': LOCATION_CODE_MAP[item['materyalin_yeri_kodu']] || item['materyalin_yeri_kodu'],
        };

        // Delete the old keys to avoid duplication in the report
        delete transformedItem['materyal_statusu_kodu'];
        delete transformedItem['odunc_verilebilirlik_kodu'];
        delete transformedItem['materyalin_yeri_kodu'];

        return transformedItem;
    });
};


const FullScreenLoader = ({ text, progress }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-white rounded-lg shadow-xl min-w-[300px]">
            <div className="flex items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xl text-slate-700 font-semibold">{text}</span>
            </div>
            {progress && progress.total > 0 && (
                <div className="w-full text-center mt-2">
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div className="bg-slate-600 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 font-mono">{`${progress.current} / ${progress.total}`}</p>
                </div>
            )}
        </div>
    </div>
);

// --- Permission Screen Component ---
// This screen is shown on first load to ask the user for camera permissions.
const PermissionScreen = ({ onDecision }) => {
    const [message, setMessage] = useState({ text: '', type: 'none' });
    const [step, setStep] = useState('initial'); // 'initial', 'requesting', 'testing', 'test_success', 'permission_denied'

    const handleDecision = (allow) => {
        localStorage.setItem('cameraPermissionChoiceMade', 'true');
        localStorage.setItem('cameraPermissionStatus', allow ? 'granted' : 'denied');
        onDecision(allow);
    };

    const requestPermission = async () => {
        setStep('requesting'); // Hide initial buttons
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setMessage({ text: '❌ Tarayıcınız kamera erişimini desteklemiyor.', type: 'error' });
            setStep('permission_denied');
            return;
        }
        try {
            // Request permission first
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Stop stream immediately after getting permission
            setMessage({ text: '✅ İzin verildi. Şimdi kameranızı test edebilirsiniz.', type: 'success' });
            setStep('testing'); // Move to testing step
        } catch (err) {
            console.error("Kamera izni hatası:", err);
            setMessage({ text: '❌ Kamera izni reddedildi. Devam etmek için lütfen tarayıcı ayarlarından izin verin ve sayfayı yenileyin.', type: 'error' });
            setStep('permission_denied');
        }
    };

    const handleCameraTest = async () => {
        try {
             // We already have permission, this is just a quick check
             const stream = await navigator.mediaDevices.getUserMedia({ video: true });
             stream.getTracks().forEach(track => track.stop());
             setMessage({ text: '✅ Kamera testi başarılı, sonraki aşamaya geçiriliyorsunuz...', type: 'success' });
             setStep('test_success');
             setTimeout(() => {
                 handleDecision(true);
             }, 2000);
        } catch(err) {
            setMessage({ text: '❌ Kamera testi başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.', type: 'error' });
            setStep('permission_denied'); // Go to a failure state
        }
    };

    const getMessageStyles = (type) => {
        switch (type) {
            case 'success': return 'text-green-600 font-bold';
            case 'error': return 'text-red-600 font-bold';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="max-w-lg w-full p-8 bg-white rounded-xl shadow-lg text-center space-y-6">
                <h1 className="text-3xl font-bold text-slate-800">Kamera Erişimi</h1>
                
                {step === 'initial' && (
                    <>
                        <div className="text-left space-y-4 text-slate-600">
                            <h2 className="text-xl font-semibold text-slate-700">Kamera İzni Ne İçin Gerekli?</h2>
                            <p>
                                Uygulamanın en pratik özelliklerinden biri, telefonunuzun veya bilgisayarınızın kamerasını kullanarak kitapların üzerindeki barkodları okumaktır. Bu sayede harici bir barkod okuyucuya veya bilgisayara ihtiyaç duymadan sayım yapabilirsiniz. Bu özelliğin çalışabilmesi için tarayıcınız sizden kameraya erişim izni ister.
                            </p>
                            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                                <h3 className="font-bold">Önemli Uyarı</h3>
                                <p className="text-sm">
                                    Kamera iznini uygulamanın ilk açılışında vermeniz şiddetle tavsiye edilir. Eğer bir sayıma başladıktan sonra tarayıcı ayarlarından izin verirseniz, sayfa yenileneceği için o ana kadar yaptığınız <strong>tüm sayım verileri silinebilir.</strong>
                                </p>
                            </div>
                        </div>

                        <p className="text-slate-600 pt-4">Sayım için kamerayı kullanmak istiyor musunuz?</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={requestPermission} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                                Evet, Sayım İçin Kamera Kullan
                            </button>
                            <button onClick={() => handleDecision(false)} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20"/><path d="M12 12H12.01"/><path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5"/><path d="M16.5 16.5 12 21l-4.5-4.5"/><path d="M19 19H5a2 2 0 0 1-2-2V7"/></svg>
                                Hayır, Kamera Kullanmayacağım
                            </button>
                        </div>
                    </>
                )}

                {step === 'testing' && (
                     <>
                         <p className={`text-lg ${getMessageStyles(message.type)}`}>{message.text}</p>
                         <div className="p-4 border border-slate-200 rounded-lg space-y-3">
                             <button onClick={handleCameraTest} className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">
                                 Kamerayı Test Et
                             </button>
                         </div>
                      </>
                )}
                
                {(step === 'requesting' || step === 'test_success' || step === 'permission_denied') && (
                     <div className={`p-4 border rounded-lg space-y-3 ${message.type === 'success' ? 'border-green-200' : 'border-red-200'}`}>
                         <p className={`mt-2 text-lg ${getMessageStyles(message.type)}`}>{message.text || 'İzin isteniyor...'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sidebar Component ---
// The main navigation sidebar for the application.
const Sidebar = ({ page, setPage, currentSessionName, selectedLibrary, kohaData, scannedItems, isMuted, setIsMuted, isMobileMenuOpen, setMobileMenuOpen, onShare, onInstall, installPrompt }) => {
    const navItems = [
        { id: 'start', label: 'Yeni Sayım', disabled: false },
        { id: 'pre-reports', label: 'Ön Raporlar', disabled: !currentSessionName || kohaData.length === 0 },
        { id: 'scan', label: 'Sayım', disabled: !selectedLibrary || kohaData.length === 0 },
        { id: 'summary', label: 'Özet & Raporlar', disabled: !selectedLibrary || kohaData.length === 0 || scannedItems.length === 0 }
    ];

    const handleLinkClick = (pageId) => {
        if (navItems.find(item => item.id === pageId)?.disabled) return;
        setPage(pageId);
        setMobileMenuOpen(false);
    };

    return (
        <>
            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}
            <aside className={`w-64 bg-white shadow-lg flex flex-col h-screen fixed top-0 left-0 z-40 transition-transform transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <div className="p-3 flex items-center justify-between border-b border-slate-200">
                     <div className="flex items-center gap-2">
                         <div className="flex flex-col">
                              <h1 className="text-lg font-bold text-slate-800">Koha Sayım Uygulaması</h1>
                              <p className="text-[10px] text-slate-500 leading-tight">(T.C. Kültür ve Turizm Bakanlığı - Kütüphaneler ve Yayımlar Genel Müdürlüğü'ne bağlı kütüphaneler için geliştirilmiştir.)</p>
                         </div>
                    </div>
                    <button className="md:hidden p-1 text-slate-500" onClick={() => setMobileMenuOpen(false)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item, index) => (
                        <button
                            key={item.id}
                            onClick={() => handleLinkClick(item.id)}
                            disabled={item.disabled}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-semibold transition-colors ${
                                page === item.id
                                    ? 'bg-slate-700 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100'
                            } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${page === item.id ? 'bg-white text-slate-800' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-200 flex justify-around items-center text-center">
                    <div className="flex flex-col items-center">
                        <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full text-slate-500 hover:bg-slate-200" title={isMuted ? "Sesi Aç" : "Sesi Kapat"}>
                            {isMuted ? ICONS.soundOff : ICONS.soundOn}
                        </button>
                        <span className="text-xs text-slate-500 mt-1">{isMuted ? "Sesi Aç" : "Sesi Kapat"}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <button onClick={onShare} className="p-2 rounded-full text-slate-500 hover:bg-slate-200" title="Uygulamayı Paylaş">
                            {ICONS.share}
                        </button>
                        <span className="text-xs text-slate-500 mt-1">Paylaş</span>
                    </div>
                    {installPrompt && (
                        <div className="flex flex-col items-center">
                            <button onClick={onInstall} className="p-2 rounded-full text-slate-500 hover:bg-slate-200" title="Uygulamayı Yükle">
                                {ICONS.install}
                            </button>
                            <span className="text-xs text-slate-500 mt-1">Yükle</span>
                        </div>
                    )}
                </div>
                <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-2 text-center">
                    <p>Geliştirici: <a href="https://ismailkaraca.com.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">İsmail KARACA</a></p>
                    <a href="https://www.ismailkaraca.com.tr/sayim.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 block mt-1">
                        Uygulama kullanımı, teknik dokümantasyon ve sistem mimarisi hakkında daha fazla bilgi için tıklayın.
                    </a>
                    <p className="mt-2 pt-2 border-t border-slate-200">© 2025 Koha Sayım Uygulaması. Tüm hakları saklıdır.</p>
                </div>
            </aside>
        </>
    );
};

const ShareModal = ({ isOpen, onClose }) => {
    const [copySuccess, setCopySuccess] = useState('');
    const shareUrl = window.location.href;
    const shareText = "Koha Sayım Uygulaması'nı keşfedin! Kütüphane sayımlarınızı kolayca yapın: ";

    const shareOptions = [
        { name: 'WhatsApp', url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + shareUrl)}` },
        { name: 'Telegram', url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
        { name: 'X (Twitter)', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
        { name: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    ];

    const copyToClipboard = () => {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed"; 
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setCopySuccess('Bağlantı kopyalandı!');
            setTimeout(() => setCopySuccess(''), 2000);
        } catch (err) {
            setCopySuccess('Kopyalanamadı.');
        }
        document.body.removeChild(textArea);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-5">
                <h3 className="text-lg font-bold mb-4 text-center">Uygulamayı Paylaş</h3>
                <div className="grid grid-cols-2 gap-4">
                    {shareOptions.map(option => (
                        <a key={option.name} href={option.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-3 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                            <span className="font-semibold text-slate-800">{option.name}</span>
                        </a>
                    ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <input type="text" readOnly value={shareUrl} className="w-full p-2 border bg-slate-200 rounded-md font-mono text-sm" />
                    <button onClick={copyToClipboard} className={`px-4 py-2 rounded-md text-white font-semibold transition-colors ${copySuccess ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}>
                        {copySuccess || 'Kopyala'}
                    </button>
                </div>
                <button onClick={onClose} className="mt-6 bg-slate-600 text-white py-2 px-4 rounded hover:bg-slate-700 w-full font-bold">Kapat</button>
            </div>
        </Modal>
    );
};

const InstallPopup = ({ onInstall, onDismiss }) => (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-11/12 max-w-md bg-slate-800 text-white p-4 rounded-lg shadow-2xl z-50 flex items-center gap-4">
        <div className="flex-shrink-0">
            {ICONS.install}
        </div>
        <div className="flex-grow">
            <h4 className="font-bold">Uygulamayı Ana Ekrana Ekleyin</h4>
            <p className="text-sm text-slate-300">Daha hızlı erişim ve çevrimdışı kullanım için yükleyin.</p>
        </div>
        <div className="flex-shrink-0 flex gap-2">
             <button onClick={onDismiss} className="px-3 py-1 text-sm rounded-md hover:bg-slate-700">Kapat</button>
             <button onClick={onInstall} className="px-4 py-2 text-sm font-bold bg-indigo-600 rounded-md hover:bg-indigo-700">Yükle</button>
        </div>
    </div>
);


const StartScreen = ({ sessions, sessionNameInput, setSessionNameInput, startNewSession, error, setError, loadSession, deleteSession, selectedLibrary, setSelectedLibrary, libraryOptions, setAddDataModal, selectedLocation, setSelectedLocation, locationOptions, kohaData, handleExcelUpload, isXlsxReady, isLoading }) => (
    <div className="w-full">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Hoş Geldiniz</h1>
        <p className="text-slate-600 mb-8">Yeni bir sayım başlatın veya kayıtlı bir oturuma devam edin.</p>
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-2xl font-semibold mb-4 text-slate-700">Yeni Sayım Başlat</h2>
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4" role="alert"><p>{error}</p></div>}
                <div className="space-y-4">
                    <input type="text" value={sessionNameInput} onChange={e => {setSessionNameInput(e.target.value); setError('')}} placeholder="Yeni sayım için bir isim girin (örn: Yetişkin Bölümü)" className="w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500" />
                    <div>
                        <label htmlFor="library-select" className="block text-sm font-medium text-slate-700 mb-1">Kütüphanenizi Seçin</label>
                        <div className="flex gap-2">
                            <select id="library-select" value={selectedLibrary} onChange={(e) => setSelectedLibrary(e.target.value)} className="w-full p-3 border border-slate-300 rounded-md shadow-sm">
                                <option value="">-- Kütüphane Seçiniz --</option>
                                {libraryOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                            </select>
                            <button onClick={()=> setAddDataModal({isOpen: true, type: 'library'})} className="px-3 bg-slate-200 rounded-md hover:bg-slate-300">Yeni Ekle</button>
                        </div>
                        <div className="text-right">
                            <a href="https://www.ismailkaraca.com.tr/kutuphanekod.html" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">Kütüphane Kod ve İsim Listesi için tıklayınız.</a>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="location-select" className="block text-sm font-medium text-slate-700 mb-1">Bölüm/Materyalin Yeri (Opsiyonel)</label>
                        <div className="flex gap-2">
                            <select id="location-select" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full p-3 border border-slate-300 rounded-md shadow-sm">
                                <option value="">-- Tüm Lokasyonlar --</option>
                                {locationOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                            </select>
                            <button onClick={()=> setAddDataModal({isOpen: true, type: 'location'})} className="px-3 bg-slate-200 rounded-md hover:bg-slate-300">Yeni Ekle</button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Yer seçimi yaparsanız, sayım yaptığınız yerde olmayan materyallerle ilgili uyarı verilecektir.</p>
                        <div className="text-right">
                            <a href="https://www.ismailkaraca.com.tr/bolumkod.html" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">Bölüm Kod ve İsim Listesi için tıklayınız.</a>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-slate-700">Koha'dan Aldığınız Sayım İçin Hazırlanmış Dosya (.xlsx)</h3>
                        <a href="https://www.ismailkaraca.com.tr/sayimdosyasi.html" target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">Sayım için materyal dosyasını indirmek için tıklayınız.</a>
                        </div>
                        <FileUploader onFileAccepted={handleExcelUpload} title={kohaData.length > 0 ? `${kohaData.length} kayıt yüklendi.` : "Dosyayı buraya sürükleyin veya seçmek için tıklayın"} disabled={!isXlsxReady || isLoading} accept={{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls']}}><svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></FileUploader>
                    </div>
                    <button onClick={startNewSession} disabled={!sessionNameInput || !selectedLibrary || kohaData.length === 0} className="w-full font-bold py-3 px-4 rounded-md transition-colors bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-400">Sayıma Başla</button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-2xl font-semibold mb-4 text-slate-700">Kayıtlı Oturumlar</h2>
                {Object.keys(sessions).length > 0 ? <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">{Object.values(sessions).sort((a,b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)).map(session => <li key={session.name} className="flex flex-col sm:flex-row items-center justify-between p-3 bg-slate-50 rounded-lg border"><div><p className="font-bold text-slate-800">{session.name}</p><p className="text-sm text-slate-500">{new Date(session.lastUpdated).toLocaleString('tr-TR')} - {session.items.length} kayıt</p></div><div className="flex gap-2 mt-2 sm:mt-0"><button onClick={() => loadSession(session.name)} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">Yükle</button><button onClick={() => deleteSession(session.name)} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Sil</button></div></li>)}</ul> : <p className="text-slate-500">Kayıtlı oturum bulunamadı.</p>}
            </div>
        </div>
    </div>
);

const ReportCard = ({ report, isXlsxReady }) => (
    <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-4 transition-shadow hover:shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-grow">
                <div className="text-slate-600 flex-shrink-0 w-6 h-6">{report.icon}</div>
                <div>
                    <h4 className="font-bold text-slate-800">{report.title}</h4>
                    <p className="text-sm text-slate-500">Format: {report.format}</p>
                </div>
            </div>
            <div className="flex-shrink-0 mt-2 sm:mt-0">
                <button onClick={report.generator} disabled={!isXlsxReady} className="flex items-center gap-2 bg-slate-700 text-white font-semibold px-4 py-2 rounded-md hover:bg-slate-800 disabled:bg-slate-400 transition-colors">{ICONS.download} İndir</button>
            </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-600 space-y-2">
            <p>{report.description}</p>
            {report.notes && <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">{report.notes.map((note,i) => <li key={i}>{note}</li>)}</ul>}
            {report.links && <div className="flex flex-col items-start gap-1">{report.links.map((link,i) => <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">{link.text}</a>)}</div>}
        </div>
    </div>
);


const PreReportsScreen = ({ currentSessionName, error, setPage, preAnalysisReports, isXlsxReady }) => (
    <div className="max-w-3xl mx-auto w-full p-8 bg-white rounded-lg shadow-sm space-y-6 border">
        <h1 className="text-3xl font-bold text-slate-800">Ön Raporlar: "{currentSessionName}"</h1>
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded" role="alert"><p>{error}</p></div>}
        <button 
            onClick={() => setPage('scan')}
            className="w-full font-bold py-3 px-4 rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
        >
            Sayıma Devam Et
        </button>
        <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-slate-500 mb-4">Bu raporlar, yüklediğiniz dosyaya göre oluşturulmuştur ve sayım işleminden bağımsızdır. Koleksiyonunuzun mevcut durumu hakkında ön bilgi sağlarlar.</p>
            <div className="space-y-4">
                {preAnalysisReports.map(report => (
                    <ReportCard key={report.id} report={report} isXlsxReady={isXlsxReady} />
                ))}
            </div>
        </div>
        <button 
            onClick={() => setPage('scan')}
            className="w-full font-bold py-3 px-4 rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
        >
            Sayıma Devam Et
        </button>
    </div>
);

const ScanScreen = ({ isCameraOpen, isQrCodeReady, isCameraAllowed, setIsCameraOpen, handleCameraScan, warningModal, currentSessionName, combinedLibraries, selectedLibrary, combinedLocations, selectedLocation, barcodeInput, handleBarcodeInput, handleManualEntry, lastScanned, handleBulkUpload, isBulkLoading, setPage, scannedItems, filteredScannedItems, searchTerm, setSearchTerm, warningFilter, setWarningFilter, handleDeleteItem, handleClearAllScans, fileUploaderKey }) => {
    const bulkUploadTitle = "Toplu barkod(12 veya 13 haneli) içeren not defteri(.txt) veya Excel(.xlsx) dosyası yüklemek için tıklayın";
    const bulkUploadAccept = {
        'text/plain': ['.txt'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/vnd.ms-excel': ['.xls']
    };

    return (
        <>
            {isCameraOpen && isQrCodeReady && isCameraAllowed && <RobustBarcodeScanner onClose={() => setIsCameraOpen(false)} onScan={handleCameraScan} isPaused={warningModal.isOpen} />}
            <div className="flex flex-col md:flex-row h-full bg-slate-50">
                <div className="w-full md:w-1/3 lg:w-1/4 p-4 bg-white border-r flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        <h2 className="text-xl font-bold text-slate-800">Sayım: {currentSessionName}</h2>
                        <div className="text-sm text-slate-600">
                            <p><span className="font-semibold">Kütüphane:</span> {combinedLibraries.get(selectedLibrary)}</p>
                            <p><span className="font-semibold">Lokasyon:</span> {selectedLocation ? combinedLocations.get(selectedLocation) : 'Tümü'}</p>
                        </div>
                        <button onClick={() => setIsCameraOpen(true)} disabled={!isQrCodeReady || !isCameraAllowed} className="w-full flex items-center justify-center gap-2 p-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Kamera İle Barkod Okutma
                        </button>
                        {!isCameraAllowed && (
                            <div className="mt-2 text-xs text-center text-red-800 bg-red-100 p-2 rounded-lg border border-red-200">
                                <p className="font-semibold">
                                    <a href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem('cameraPermissionChoiceMade'); localStorage.removeItem('cameraPermissionStatus'); window.location.reload(); }} className="underline hover:text-red-900">
                                        Kamera İzni Vermek İçin Tıklayın.
                                    </a>
                                </p>
                                <p className="font-bold mt-1">Not: Tüm işlemler sıfırlanacaktır.</p>
                            </div>
                        )}
                        <form onSubmit={handleManualEntry} className="space-y-2">
                            <label htmlFor="barcode-input" className="font-semibold text-slate-700">Barkod Okut/Gir:</label>
                            <input id="barcode-input" type="tel" value={barcodeInput} onChange={handleBarcodeInput} placeholder="Barkodu okutun veya elle girin" className="w-full p-2 border border-slate-300 rounded-md" autoFocus />
                            <button type="submit" className="w-full bg-slate-600 text-white p-2 rounded-md hover:bg-slate-700">Ekle</button>
                        </form>
                        {lastScanned && <div className={`p-3 rounded-md border-l-4 ${lastScanned.isValid ? 'bg-green-100 border-green-500' : 'bg-yellow-100 border-yellow-500'}`}><p className="font-mono text-slate-800">{lastScanned.barcode}</p><p className="text-sm text-slate-600">{lastScanned.data?.['eser_adi'] || 'Eser bilgisi bulunamadı'}</p>{lastScanned.warnings.map(w => <p key={w.id} style={{color: w.color}} className="text-sm font-semibold">{w.message || w.text}</p>)}</div>}
                        <div className="mt-4">
                            <button onClick={() => setPage('update-on-loan')} disabled={scannedItems.length === 0 || isBulkLoading} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed">Sayımı Bitir</button>
                            <p className="text-xs text-slate-500 text-center mt-2">"Sayımı Bitir"e tıkladığınızda; özet grafikler ve raporlar görüntülenir. Daha sonra menüden "Sayım" ekranına tekrar dönüş yapabilirsiniz.</p>
                        </div>
                        <div className="mt-4 space-y-2">
                            <div>
                                <label className="font-semibold text-slate-700">Toplu Yükleme (.txt/.xlsx):</label>
                                <FileUploader key={fileUploaderKey} onFileAccepted={handleBulkUpload} title={bulkUploadTitle} accept={bulkUploadAccept} disabled={isBulkLoading} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-2/3 lg:w-3/4 p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-slate-800">Okutulan Materyaller ({filteredScannedItems.length} / {scannedItems.length})</h3>
                        <button onClick={handleClearAllScans} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400" disabled={scannedItems.length === 0}>
                            Tümünü Sil
                        </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                        <input type="text" placeholder="Barkod veya eserde ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow p-2 border border-slate-300 rounded-md" />
                        <select value={warningFilter} onChange={e => setWarningFilter(e.target.value)} className="p-2 border border-slate-300 rounded-md">
                            <option value="all">Tümünü Göster</option>
                            {Object.values(WARNING_DEFINITIONS).map(w => <option key={w.id} value={w.id}>{w.text}</option>)}
                        </select>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                        {filteredScannedItems.map((item, index) => (
                            <div key={`${item.timestamp}-${index}`} className={`p-2 rounded-md border flex items-center justify-between gap-2 ${item.isValid ? 'bg-white' : 'bg-yellow-50'}`}>
                                <div className="flex-grow">
                                    <p className="font-mono text-slate-800">{item.barcode}</p>
                                    <p className="text-xs text-slate-600">{item.data?.['eser_adi'] || 'Bilinmeyen Eser'}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="flex flex-wrap justify-end gap-1">
                                        {item.warnings.map(w => <span key={`${w.id}-${item.timestamp}-${index}`} style={{backgroundColor: w.color, color: '#fff'}} className="px-2 py-1 text-xs font-semibold rounded-full">{w.message || w.text}</span>)}
                                        {item.isValid && <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Temiz</span>}
                                    </div>
                                    <button onClick={() => handleDeleteItem(item.timestamp)} className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600" title="Bu kaydı sil">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

const UpdateOnLoanScreen = ({ handleOnLoanUpload, setPage, isXlsxReady, isLoading }) => (
    <div className="max-w-3xl mx-auto w-full p-8 bg-white rounded-lg shadow-sm space-y-6 border">
        <h1 className="text-3xl font-bold text-slate-800">Güncel Ödünç Verilmiş Materyalleri Yükle</h1>
        <p className="text-slate-600 mb-4">
            Eğer sayım sırasında ödünç verme işlemi yapıldıysa, Koha'dan alacağınız güncel ödünç verilmiş materyallerin listesini (sadece barkodları içeren .txt veya .xlsx) buraya yükleyerek eksik listesinin daha doğru oluşturulmasını sağlayabilirsiniz.
        </p>
        <a href="https://www.ismailkaraca.com.tr/gulcelodunc.html" target="_blank" rel="noopener noreferrer" className="w-full mb-2 inline-block text-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">Güncel Ödünç Listesi indirmek için tıklayınız</a>
        <FileUploader 
            onFileAccepted={handleOnLoanUpload} 
            title="Güncel ödünç listesini buraya sürükleyin veya seçmek için tıklayın" 
            disabled={!isXlsxReady || isLoading} 
            accept={{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'], 'text/plain': ['.txt']}}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v5m-4 4h-5m5-4l-5 4m0 0l-5-4m5 4v-7" /></svg>
        </FileUploader>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
             <button 
                onClick={() => setPage('summary')}
                className="w-full font-bold py-3 px-4 rounded-md transition-colors bg-slate-600 text-white hover:bg-slate-700"
            >
                Bu Adımı Atla ve Raporları Gör
            </button>
        </div>
    </div>
);


const SummaryScreen = ({ currentSessionName, summaryData, preAnalysisReports, postScanReports, isXlsxReady, isHtmlToImageReady }) => {
    const generalStatusRef = useRef(null);
    const materialStatusRef = useRef(null);
    const warningBarRef = useRef(null);
    const scanProgressRef = useRef(null);
    const topErrorRef = useRef(null);
    const locationStatusRef = useRef(null);

    const downloadChart = useCallback((ref, fileName) => {
        if (ref.current === null || !isHtmlToImageReady || !window.htmlToImage) {
            console.error("Grafik referansı veya kütüphane hazır değil.");
            alert("Grafik indirme özelliği şu anda hazır değil, lütfen birkaç saniye bekleyip tekrar deneyin.");
            return;
        }
        window.htmlToImage.toPng(ref.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Grafik indirilemedi!', err);
            });
    }, [isHtmlToImageReady]);

    const downloadAllCharts = async () => {
        const charts = [
            { ref: generalStatusRef, name: `genel_durum_${currentSessionName}.png` },
            { ref: materialStatusRef, name: `materyal_statusu_${currentSessionName}.png` },
            { ref: warningBarRef, name: `uyari_turleri_${currentSessionName}.png` },
            { ref: scanProgressRef, name: `sayim_ilerlemesi_${currentSessionName}.png` },
            { ref: topErrorRef, name: `hata_veren_lokasyonlar_${currentSessionName}.png` },
            { ref: locationStatusRef, name: `lokasyon_durumu_${currentSessionName}.png` },
        ];

        for (const chart of charts) {
            if (chart.ref.current) { // Sadece mevcut olan grafikleri indir
                await new Promise(resolve => {
                    downloadChart(chart.ref, chart.name);
                    setTimeout(resolve, 500); // download prompt'ları arasında kısa bir bekleme
                });
            }
        }
    };

    const downloadAllReports = async () => {
        const allReports = [...postScanReports, ...preAnalysisReports];

        for (const report of allReports) {
            if (report.generator) {
                report.generator();
                await new Promise(resolve => setTimeout(resolve, 500)); // Tarayıcının engellememesi için 500ms bekleme
            }
        }
    };

    const renderLegendWithCount = (value, entry) => {
        const { color } = entry;
        return <span style={{ color }}>{value} ({entry.payload.value})</span>;
    };

    const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold">
                {value > 0 ? value : ''}
            </text>
        );
    };

    if (!summaryData) {
        return <div className="text-center p-10">Raporları görmek için lütfen sayıma başlayın.</div>;
    }

    const ChartContainer = ({ chartRef, title, children, fileName }) => (
        <div ref={chartRef} className="bg-white p-6 rounded-lg shadow-sm border h-96 flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-center text-slate-700 flex-1">{title}</h3>
                <button onClick={() => downloadChart(chartRef, fileName)} disabled={!isHtmlToImageReady} title="Grafiği İndir" className="p-1 text-slate-500 hover:bg-slate-200 rounded-full disabled:opacity-50">
                    {ICONS.download}
                </button>
            </div>
            <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
    );

    return (
        <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-2">
                <h1 className="text-3xl font-bold text-slate-800">Sayım Özeti: {currentSessionName}</h1>
                <div className="flex flex-wrap gap-2">
                    <button onClick={downloadAllCharts} disabled={!isHtmlToImageReady} className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50">
                        {ICONS.download} Tüm Grafikleri İndir
                    </button>
                    <button onClick={downloadAllReports} disabled={!isXlsxReady} className="flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {ICONS.download} Tüm Raporları İndir
                    </button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                    <div className="bg-blue-100 p-4 rounded-lg"><p className="text-2xl font-bold text-blue-800">{summaryData.totalScanned}</p><p>Toplam Okutulan</p></div>
                    <div className="bg-green-100 p-4 rounded-lg"><p className="text-2xl font-bold text-green-800">{summaryData.valid}</p><p>Geçerli (Temiz)</p></div>
                    <div className="bg-yellow-100 p-4 rounded-lg"><p className="text-2xl font-bold text-yellow-800">{summaryData.invalid}</p><p>Hatalı/Uyarılı</p></div>
                    <div className="bg-slate-200 p-4 rounded-lg"><p className="text-2xl font-bold text-slate-800">{summaryData.notScannedCount}</p><p>Eksik</p></div>
                    <div className="bg-indigo-100 p-4 rounded-lg"><p className="text-2xl font-bold text-indigo-800">{summaryData.scanSpeed}</p><p>Materyal / dk</p></div>
                </div>
                <p className="text-xs text-center mt-4 text-slate-500">Not: "Geçerli", "Hatalı/Uyarılı" ve "Eksik" sayıları, sadece materyal statüsü "0" (Eser Koleksiyonda) olanlar üzerinden hesaplanmıştır.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-8">
                <ChartContainer chartRef={generalStatusRef} title="Genel Durum (Aktif Koleksiyon)" fileName={`genel_durum_${currentSessionName}.png`}>
                    <PieChart><Pie data={summaryData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={renderPieLabel}>{summaryData.pieData.map((entry, i) => <Cell key={`cell-${i}`} fill={PIE_CHART_COLORS[entry.name === 'Geçerli' ? 'valid' : entry.name === 'Uyarılı' ? 'invalid' : 'missing']} />)}</Pie><Tooltip content={<CustomTooltip />} /><Legend formatter={renderLegendWithCount} /></PieChart>
                </ChartContainer>
                <ChartContainer chartRef={materialStatusRef} title="Materyal Statüsü (Tüm Liste)" fileName={`materyal_statusu_${currentSessionName}.png`}>
                    <PieChart><Pie data={summaryData.materialStatusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>{summaryData.materialStatusPieData.map((e, i) => <Cell key={`cell-${i}`} fill={['#3498DB', '#E74C3C', '#9B59B6', '#F1C40F'][i % 4]} />)}</Pie><Tooltip content={<CustomTooltip />} /><Legend formatter={renderLegendWithCount} /></PieChart>
                </ChartContainer>
                <ChartContainer chartRef={warningBarRef} title="Uyarı Türleri (Tüm Okutulanlar)" fileName={`uyari_turleri_${currentSessionName}.png`}>
                    <BarChart data={summaryData.warningBarData} layout="vertical" margin={{left: 100}}><CartesianGrid strokeDasharray="3 3" stroke={'#ccc'} /><XAxis type="number" stroke={'#666'} /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: '#333' }} stroke={'#666'} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="Sayı">{summaryData.warningBarData.map((e, i) => <Cell key={`cell-${i}`} fill={WARNING_DEFINITIONS[Object.keys(WARNING_DEFINITIONS).find(k => WARNING_DEFINITIONS[k].text === e.name)]?.color || '#8884d8'} />)}<LabelList dataKey="Sayı" position="right" style={{ fill: '#333' }} /></Bar></BarChart>
                </ChartContainer>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartContainer chartRef={scanProgressRef} title="Sayım İlerleme Grafiği" fileName={`sayim_ilerlemesi_${currentSessionName}.png`}>
                    <LineChart data={summaryData.scanProgressData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="Okutulan Sayısı" stroke="#8884d8" activeDot={{ r: 8 }} /></LineChart>
                </ChartContainer>
                <ChartContainer chartRef={topErrorRef} title="En Çok Hata Veren Raf/Lokasyon" fileName={`hata_veren_lokasyonlar_${currentSessionName}.png`}>
                    <BarChart layout="vertical" data={summaryData.topErrorLocationsData} margin={{ top: 20, right: 30, left: 100, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" /><Tooltip /><Legend /><Bar dataKey="Hata Sayısı" fill="#E74C3C"><LabelList dataKey="Hata Sayısı" position="right" style={{ fill: '#333' }} /></Bar></BarChart>
                </ChartContainer>
            </div>
            <div ref={locationStatusRef} className="bg-white p-6 rounded-lg shadow-sm border h-[500px] mb-8 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-semibold text-center text-slate-700 flex-1">Lokasyon Bazında Sayım Durumu (Aktif Koleksiyon)</h3>
                    <button onClick={() => downloadChart(locationStatusRef, `lokasyon_durumu_${currentSessionName}.png`)} disabled={!isHtmlToImageReady} title="Grafiği İndir" className="p-1 text-slate-500 hover:bg-slate-200 rounded-full disabled:opacity-50">
                        {ICONS.download}
                    </button>
                </div>
                <ResponsiveContainer>
                    <BarChart data={summaryData.locationStatusData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} />
                        <YAxis />
                        <Tooltip />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 10 }}/>
                        <Bar dataKey="Geçerli" stackId="a" fill="#2ECC71" />
                        <Bar dataKey="Uyarılı" stackId="a" fill="#FAD7A0" />
                        <Bar dataKey="Eksik" stackId="a" fill="#95A5A6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-10">
                <div className="mb-12">
                    <h2 className="text-3xl font-bold mb-2 text-slate-800">Sayım Sonucu Raporları</h2>
                    <p className="text-slate-600 mb-6">Bu raporlar, sayım işlemi sırasında okutulan barkodlara göre oluşturulmuştur.</p>
                    <div className="space-y-4">
                        {postScanReports.map(report => (
                            <ReportCard key={report.id} report={report} isXlsxReady={isXlsxReady} />
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="text-3xl font-bold mb-2 text-slate-800">Dosya Ön Analiz Raporları</h2>
                    <p className="text-slate-600 mb-6">Bu raporlar, sayım işleminden bağımsız olarak, yalnızca başlangıçta yüklediğiniz Koha dosyasına göre oluşturulmuştur.</p>
                    <div className="space-y-4">
                        {preAnalysisReports.map(report => (
                            <ReportCard key={report.id} report={report} isXlsxReady={isXlsxReady} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    // Dynamically load necessary external scripts
    const isXlsxReady = useScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
    const isQrCodeReady = useScript('https://unpkg.com/html5-qrcode', 'Html5Qrcode');
    const isHtmlToImageReady = useScript('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js', 'htmlToImage');
    
    // State management for the entire application
    const [page, setPage] = useState('permission'); // 'permission', 'start', 'pre-reports', 'scan', 'summary'
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isCameraAllowed, setIsCameraAllowed] = useState(false);
    const [sessions, setSessions] = useState({});
    const [currentSessionName, setCurrentSessionName] = useState('');
    const [sessionNameInput, setSessionNameInput] = useState('');
    const [selectedLibrary, setSelectedLibrary] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [kohaData, setKohaData] = useState([]);
    const [kohaDataMap, setKohaDataMap] = useState(new Map());
    const [scannedItems, setScannedItems] = useState([]);
    const [lastScanned, setLastScanned] = useState(null);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [fileUploaderKey, setFileUploaderKey] = useState(0);
    const [error, setError] = useState('');
    const [warningModal, setWarningModal] = useState({ isOpen: false, title: '', warnings: [], barcode: null });
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
    const [addDataModal, setAddDataModal] = useState({ isOpen: false, type: ''});
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [customLibraries, setCustomLibraries] = useState({});
    const [customLocations, setCustomLocations] = useState({});
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isProcessingScan, setIsProcessingScan] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [warningFilter, setWarningFilter] = useState('all');
    const [isMuted, setIsMuted] = useState(false);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [showInstallPopup, setShowInstallPopup] = useState(false);
    const [isNavigatingToSummary, setIsNavigatingToSummary] = useState(false);
    const [isRestoringSession, setIsRestoringSession] = useState(false);
    
    const processedBarcodesRef = useRef(new Set());
    const manualInputDebounceRef = useRef(null);

    useEffect(() => {
        // --- PWA SETUP ---
        // 1. Create and register the service worker
        const serviceWorkerCode = `
            const CACHE_NAME = 'koha-sayim-cache-v1';
            const urlsToCache = [
                '/',
                'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                'https://unpkg.com/html5-qrcode',
                'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js'
            ];

            self.addEventListener('install', event => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            console.log('Opened cache');
                            return cache.addAll(urlsToCache);
                        })
                );
            });

            self.addEventListener('fetch', event => {
                event.respondWith(
                    caches.match(event.request)
                        .then(response => {
                            if (response) {
                                return response;
                            }
                            return fetch(event.request);
                        })
                );
            });

            self.addEventListener('activate', event => {
              const cacheWhitelist = [CACHE_NAME];
              event.waitUntil(
                caches.keys().then(cacheNames => {
                  return Promise.all(
                    cacheNames.map(cacheName => {
                      if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                      }
                    })
                  );
                })
              );
            });
        `;
        const swBlob = new Blob([serviceWorkerCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(swBlob);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(swUrl)
                .then(registration => console.log('Service Worker registered with scope:', registration.scope))
                .catch(error => console.log('Service Worker registration failed:', error));
        }

        // 2. Create and link the manifest file
        const manifest = {
            "name": "Koha Sayım Uygulaması",
            "short_name": "Koha Sayım",
            "start_url": "https://koha-sayim-uygulamasi.vercel.app/",
            "display": "standalone",
            "background_color": "#f1f5f9",
            "theme_color": "#1e293b",
            "description": "Koha için geliştirilmiş barkod tabanlı sayım uygulaması.",
            "icons": [
                {
                    "src": "/icon-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "/icon-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ]
        };
        const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const manifestUrl = URL.createObjectURL(manifestBlob);
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);

        // --- PWA INSTALL PROMPT ---
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
            const dismissed = localStorage.getItem('installPopupDismissed');
            if (!dismissed) {
                setShowInstallPopup(true);
            }
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            document.head.removeChild(link);
        };
    }, []);

    const handleInstallClick = () => {
        if (!installPrompt) return;
        setShowInstallPopup(false);
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Kullanıcı uygulamayı yükledi');
            } else {
                console.log('Kullanıcı yükleme istemini reddetti');
            }
            setInstallPrompt(null);
        });
    };
    
    const handleDismissInstallPopup = () => {
        setShowInstallPopup(false);
        localStorage.setItem('installPopupDismissed', 'true');
    };


    // Load settings from localStorage on initial mount
    useEffect(() => {
        const savedMute = localStorage.getItem('isMuted') === 'true';
        setIsMuted(savedMute);
    }, []);

    // Save mute setting to localStorage
    useEffect(() => {
        localStorage.setItem('isMuted', isMuted);
    }, [isMuted]);

    const playSound = useCallback((note) => {
        if (isMuted) return;
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }
            synth.triggerAttackRelease(note, "8n");
        } catch (e) {
            console.error("Ses çalınamadı:", e);
        }
    }, [isMuted]);

    const playMultipleWarningSound = useCallback(() => {
        if (isMuted) return;
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }
            const now = Tone.now();
            synth.triggerAttackRelease("C5", "16n", now);
            synth.triggerAttackRelease("G4", "16n", now + 0.1);
            synth.triggerAttackRelease("C5", "16n", now + 0.2);
            synth.triggerAttackRelease("G4", "16n", now + 0.3);
            synth.triggerAttackRelease("E5", "8n", now + 0.4);
        } catch (e) {
            console.error("Ses çalınamadı:", e);
        }
    }, [isMuted]);
    
    const loadSession = useCallback((sessionName) => {
        const sessionString = localStorage.getItem(`koha_session_${sessionName}`);
        if (sessionString) {
            const session = JSON.parse(sessionString);
            setCurrentSessionName(session.name);
            setSelectedLibrary(session.library);
            setSelectedLocation(session.location);
            setScannedItems(session.items || []);
            processedBarcodesRef.current = new Set((session.items || []).map(i => i.barcode));
            setLastScanned((session.items || []).length > 0 ? session.items[0] : null);
            
            // IMPORTANT: Clear kohaData and require re-upload to prevent storage issues.
            setKohaData([]);
            setKohaDataMap(new Map());
            setError(`"${sessionName}" oturumu yüklendi. Devam etmek için lütfen ilgili Koha sayım dosyasını (.xlsx) tekrar yükleyin.`);
            setPage('start'); // Go back to start to re-upload
            setIsRestoringSession(true);
        }
    }, []);

    useEffect(() => {
        try {
            const choiceMade = localStorage.getItem('cameraPermissionChoiceMade');
            if (choiceMade) {
                const permissionStatus = localStorage.getItem('cameraPermissionStatus');
                setIsCameraAllowed(permissionStatus === 'granted');
                setPage('start');
            } else {
                setPage('permission');
            }

            const savedSessions = localStorage.getItem('kohaInventorySessions');
            if (savedSessions) setSessions(JSON.parse(savedSessions));
            const savedLibs = localStorage.getItem('customLibraries');
            if (savedLibs) setCustomLibraries(JSON.parse(savedLibs));
            const savedLocs = localStorage.getItem('customLocations');
            if (savedLocs) setCustomLocations(JSON.parse(savedLocs));

            // **NEW**: Restore active session on page load
            const activeSessionName = localStorage.getItem('activeKohaSessionName');
            if (activeSessionName && localStorage.getItem(`koha_session_${activeSessionName}`)) {
                loadSession(activeSessionName);
            }

        } catch (e) {
            console.error("Veriler yüklenemedi:", e);
            setPage('start'); // Fallback to start page on error
        }
    }, [loadSession]);
    
    // **NEW**: Add protection against accidental page refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            // Only show prompt if a session is active
            if (currentSessionName) {
                e.preventDefault();
                e.returnValue = ''; // Required for cross-browser compatibility
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [currentSessionName]);

    // Auto-save session data to localStorage whenever it changes
    useEffect(() => {
        if (currentSessionName) {
            const sessionToSave = {
                name: currentSessionName,
                library: selectedLibrary,
                location: selectedLocation,
                items: scannedItems,
                lastUpdated: new Date().toISOString()
            };
    
            try {
                localStorage.setItem(`koha_session_${currentSessionName}`, JSON.stringify(sessionToSave));
                localStorage.setItem('activeKohaSessionName', currentSessionName); // **NEW**: Save active session name
                
                setSessions(prev => {
                    const updatedSessions = {...prev};
                    updatedSessions[currentSessionName] = {
                        name: currentSessionName, 
                        items: { length: scannedItems.length },
                        lastUpdated: new Date().toISOString()
                    };
                    localStorage.setItem('kohaInventorySessions', JSON.stringify(updatedSessions));
                    return updatedSessions;
                });
            } catch (e) {
                 console.error("Oturum kaydedilemedi:", e);
                 setError("Oturum kaydedilirken bir hata oluştu. Tarayıcı depolama alanı dolu olabilir.");
            }
        }
    }, [currentSessionName, selectedLibrary, selectedLocation, scannedItems]);

    const handlePermissionDecision = (allow) => {
        setIsCameraAllowed(allow);
        setPage('start');
    };

    const startNewSession = () => {
        if (!sessionNameInput) { setError("Lütfen yeni sayım için bir isim girin."); return; }
        if (sessions[sessionNameInput]) { setError("Bu isimde bir sayım zaten mevcut. Farklı bir isim seçin."); return; }
        
        setCurrentSessionName(sessionNameInput);
        setScannedItems([]);
        setLastScanned(null);
        processedBarcodesRef.current.clear();
        setError('');
        setPage('pre-reports');
    };
    
    const deleteSession = useCallback((sessionName) => {
        setConfirmationModal({
            isOpen: true,
            message: `"${sessionName}" isimli sayımı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
            onConfirm: () => {
                const newSessions = { ...sessions };
                delete newSessions[sessionName];
                setSessions(newSessions);
                localStorage.removeItem(`koha_session_${sessionName}`);
                localStorage.setItem('kohaInventorySessions', JSON.stringify(newSessions));

                // **NEW**: Clear active session if it's the one being deleted
                if (localStorage.getItem('activeKohaSessionName') === sessionName) {
                    localStorage.removeItem('activeKohaSessionName');
                    if (currentSessionName === sessionName) {
                        setCurrentSessionName('');
                        setSessionNameInput('');
                        setSelectedLibrary('');
                        setSelectedLocation('');
                        setScannedItems([]);
                        setKohaData([]);
                        setKohaDataMap(new Map());
                        processedBarcodesRef.current.clear();
                        setLastScanned(null);
                        setError('');
                        setPage('start');
                    }
                }
            }
        });
    }, [sessions, currentSessionName]);
    
    const handleAddCustomData = (type, code, name) => {
        if (type === 'library') {
            const newCustomLibraries = {...customLibraries, [code]: name};
            setCustomLibraries(newCustomLibraries);
            localStorage.setItem('customLibraries', JSON.stringify(newCustomLibraries));
            setSelectedLibrary(code);
        } else {
            const newCustomLocations = {...customLocations, [code]: name};
            setCustomLocations(newCustomLocations);
            localStorage.setItem('customLocations', JSON.stringify(newCustomLocations));
            setSelectedLocation(code);
        }
    };
    
    const libraryOptions = useMemo(() => {
        const optionsMap = new Map(INITIAL_LIBRARIES);
        Object.entries(customLibraries).forEach(([code, name]) => optionsMap.set(code, name));
        return Array.from(optionsMap.entries());
    }, [customLibraries]);

    const locationOptions = useMemo(() => {
        const optionsMap = new Map(INITIAL_LOCATIONS);
        Object.entries(customLibraries).forEach(([code, name]) => optionsMap.set(code, name));
        return Array.from(optionsMap.entries());
    }, [customLibraries]);

    const combinedLibraries = useMemo(() => new Map(libraryOptions), [libraryOptions]);
    const combinedLocations = useMemo(() => new Map(locationOptions), [locationOptions]);

    const handleExcelUpload = (file) => {
        if (!file || !isXlsxReady) return;
        setIsLoading(true);
        setError('');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet);
                if (json.length === 0 || !json[0].hasOwnProperty('barkod')) throw new Error("Yüklenen dosyada 'barkod' sütunu bulunamadı.");
                setKohaData(json);
                setKohaDataMap(new Map(json.map(item => [String(item.barkod), item])));
                if (isRestoringSession) {
                    setError(''); // Clear the "please upload" message
                    setPage('scan');
                    setIsRestoringSession(false);
                }
            } catch (err) { setError(`Dosya okunurken bir hata oluştu: ${err.message}`); } finally { setIsLoading(false); }
        };
        reader.onerror = () => { setIsLoading(false); setError("Dosya okuma başarısız oldu."); }
        reader.readAsArrayBuffer(file);
    };
    
    const isIsbn = (barcode) => {
        const code = String(barcode).replace(/[^0-9]/g, '');
        if (code.length !== 13) return false;
        if (!code.startsWith('978') && !code.startsWith('979')) return false;

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(code[i]);
            sum += (i % 2 === 0) ? digit * 1 : digit * 3;
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        
        return checkDigit === parseInt(code[12]);
    };

    // Core logic for processing a scanned or entered barcode
    const processBarcode = useCallback((barcode, isBulk = false) => {
        const rawBarcode = String(barcode).trim();
        if (!rawBarcode || !selectedLibrary) return { outcome: 'ignored' };

        if (isIsbn(rawBarcode)) {
            const warning = WARNING_DEFINITIONS.isbnDetected;
            if (!isBulk) {
                playSound(warning.sound);
                setWarningModal({ isOpen: true, title: 'ISBN Algılandı', warnings: [warning], barcode: rawBarcode });
            }
            return { outcome: 'isbn' };
        }
        
        let originalBarcode = rawBarcode.replace(/[^0-9]/g, '');
        let normalizedBarcode = originalBarcode;
        let wasAutoCompleted = false;

        const expectedPrefix = String(parseInt(selectedLibrary, 10) + 1000);

        if (normalizedBarcode.length >= 13) { 
            normalizedBarcode = normalizedBarcode.slice(0, 12);
        }
        
        if(normalizedBarcode.length < 12 && normalizedBarcode.length > 0) {
             wasAutoCompleted = true; 
             normalizedBarcode = expectedPrefix + originalBarcode.padStart(12 - expectedPrefix.length, '0');
        }
        
        if (processedBarcodesRef.current.has(normalizedBarcode)) {
            const warning = WARNING_DEFINITIONS.duplicate;
            const existingItemData = scannedItems.find(item => item.barcode === normalizedBarcode)?.data || kohaDataMap.get(normalizedBarcode);
            const scanResult = { barcode: normalizedBarcode, isValid: false, warnings: [warning], data: existingItemData, timestamp: new Date().toISOString() };
            setScannedItems(prev => [scanResult, ...prev]);
            setLastScanned(scanResult);
            if (!isBulk) {
                playSound(warning.sound);
                setWarningModal({ isOpen: true, title: 'Tekrarlı Barkod Uyarısı', warnings: [warning], barcode: normalizedBarcode });
            }
            return { outcome: 'error', warnings: [warning] };
        }
        
        processedBarcodesRef.current.add(normalizedBarcode);
        
        if (normalizedBarcode.length === 12 && !normalizedBarcode.startsWith(expectedPrefix)) {
            let finalWarning = null;
            let found = false;
            for (const [code, name] of combinedLibraries.entries()) {
                const prefix = String(parseInt(code, 10) + 1000);
                if (normalizedBarcode.startsWith(prefix)) {
                    finalWarning = { ...WARNING_DEFINITIONS.wrongLibrary, message: `Farklı Kütüphane (${name})`, libraryName: name };
                    found = true;
                    break;
                }
            }
            if (!found) {
                finalWarning = WARNING_DEFINITIONS.invalidStructure;
            }
            const scanResult = { barcode: originalBarcode, isValid: false, warnings: [finalWarning], data: kohaDataMap.get(normalizedBarcode) || null, timestamp: new Date().toISOString() };
            setLastScanned(scanResult);
            setScannedItems(prev => [scanResult, ...prev]);
            if (!isBulk) {
                playSound(finalWarning.sound);
                setWarningModal({ isOpen: true, title: 'Hatalı Barkod', warnings: [finalWarning], barcode: originalBarcode });
            }
            return { outcome: 'error', warnings: [finalWarning] };
        }

        const itemData = kohaDataMap.get(normalizedBarcode);
        const warnings = [];
        if (itemData) {
            // Library code check is now done via barcode prefix, so it's removed from here.
            if (selectedLocation && String(itemData['materyalin_yeri_kodu'] || '') !== selectedLocation) warnings.push(WARNING_DEFINITIONS.locationMismatch);
            const loanEligibilityCode = String(itemData['odunc_verilebilirlik_kodu']);
            if (!['0', '2'].includes(loanEligibilityCode)) {
                 warnings.push({ ...WARNING_DEFINITIONS.notLoanable, message: `Ödünç Verilemez` });
            }
            if (String(itemData['materyal_statusu_kodu']) !== '0') warnings.push(WARNING_DEFINITIONS.notInCollection);
            if (String(itemData['odunc_durumu']) === '1') warnings.push(WARNING_DEFINITIONS.onLoan);
        } else {
             warnings.push(wasAutoCompleted ? WARNING_DEFINITIONS.autoCompletedNotFound : WARNING_DEFINITIONS.deleted);
        }
        
        const scanResult = { barcode: normalizedBarcode, isValid: warnings.length === 0, hasWarnings: warnings.length > 0, warnings, data: itemData, timestamp: new Date().toISOString() };
        setLastScanned(scanResult);
        setScannedItems(prev => [scanResult, ...prev]);
        
        if (warnings.length > 0) {
            if (!isBulk) {
                if (warnings.length > 1) playMultipleWarningSound();
                else playSound(warnings[0].sound);
                setWarningModal({ isOpen: true, title: 'Uyarılar', warnings, barcode: normalizedBarcode });
            }
            return { outcome: 'error', warnings };
        }
        
        if (!isBulk) playSound('C5');
        return { outcome: 'success' };
    }, [selectedLibrary, selectedLocation, kohaDataMap, combinedLibraries, playSound, playMultipleWarningSound, scannedItems]);

    const processBarcodesInChunks = useCallback((barcodes) => {
        const chunkSize = 200; // Process 200 barcodes per chunk for better responsiveness
        let index = 0;
        setBulkProgress({ current: 0, total: barcodes.length });
    
        function processChunk() {
            const end = Math.min(index + chunkSize, barcodes.length);
            for (let i = index; i < end; i++) {
                // We pass 'true' for isBulk to suppress individual modals/sounds
                processBarcode(barcodes[i], true);
            }
            index = end;
            
            // Update progress after processing the chunk
            setBulkProgress(prev => ({ ...prev, current: index }));
    
            if (index < barcodes.length) {
                // Yield to the main thread before processing the next chunk
                setTimeout(processChunk, 0); 
            } else {
                // All chunks are processed
                setIsBulkLoading(false);
                setBulkProgress({ current: 0, total: 0 });
                setFileUploaderKey(prevKey => prevKey + 1); // Reset the file uploader
            }
        }
        processChunk();
    }, [processBarcode]);

    const handleBulkUpload = useCallback((file) => {
        if (!file) return;
        setIsBulkLoading(true);
        setError('');
        const reader = new FileReader();
        const fileExtension = file.name.split('.').pop().toLowerCase();

        reader.onload = (e) => {
            try {
                let barcodes = [];
                if (fileExtension === 'txt') {
                    barcodes = e.target.result.split(/\r?\n/).filter(line => line.trim() !== '');
                } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    if (!isXlsxReady) {
                        setError("Excel kütüphanesi henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.");
                        setIsBulkLoading(false);
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    barcodes = json.map(row => row[0]).filter(barcode => barcode !== null && barcode !== undefined && String(barcode).trim() !== '');
                }
                // Start processing barcodes in chunks instead of all at once
                processBarcodesInChunks(barcodes);
            } catch (err) {
                setError(`Toplu yükleme sırasında hata: ${err.message}`);
                setIsBulkLoading(false);
            }
        };

        reader.onerror = () => {
            setError("Dosya okuma başarısız oldu.");
            setIsBulkLoading(false);
        };

        if (fileExtension === 'txt') {
            reader.readAsText(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            reader.readAsArrayBuffer(file);
        } else {
            setError("Lütfen geçerli bir .txt veya .xlsx dosyası yükleyin.");
            setIsBulkLoading(false);
        }
    }, [isXlsxReady, processBarcodesInChunks]);

    const handleCameraScan = useCallback((decodedText) => {
        setIsProcessingScan(true);
        const result = processBarcode(decodedText);
        if (result.outcome === 'error') {
            setIsCameraOpen(false);
        }
        // If outcome is 'isbn' or 'success', the camera stays open
        setTimeout(() => setIsProcessingScan(false), 500);
        return result;
    }, [processBarcode]);
    
    const handleBarcodeInput = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setBarcodeInput(value);

        if (manualInputDebounceRef.current) {
            clearTimeout(manualInputDebounceRef.current);
        }
        
        if (value.length >= 12) {
            manualInputDebounceRef.current = setTimeout(() => {
                processBarcode(value);
                setBarcodeInput('');
            }, 100);
        }
    };
    
    const handleDeleteItem = (timestampToDelete) => { 
        setConfirmationModal({ 
            isOpen: true, 
            message: "Bu kaydı silmek istediğinizden emin misiniz?", 
            onConfirm: () => { 
                let barcodeToDelete;
                let isLastInstanceOfBarcode = false;

                setScannedItems(currentItems => {
                    const itemToDelete = currentItems.find(item => item.timestamp === timestampToDelete);
                    if (!itemToDelete) return currentItems;
                    
                    barcodeToDelete = itemToDelete.barcode;
                    const count = currentItems.filter(item => item.barcode === barcodeToDelete).length;
                    isLastInstanceOfBarcode = count === 1;

                    const newItems = currentItems.filter(item => item.timestamp !== timestampToDelete);

                    if (lastScanned && lastScanned.timestamp === timestampToDelete) {
                        setLastScanned(newItems.length > 0 ? newItems[0] : null);
                    }
                    
                    if (isLastInstanceOfBarcode) {
                        processedBarcodesRef.current.delete(barcodeToDelete);
                    }
                    return newItems;
                });
            } 
        }); 
    };
    
    const handleClearAllScans = () => {
        setConfirmationModal({
            isOpen: true,
            message: "Okutulan tüm barkodları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
            onConfirm: () => {
                setScannedItems([]);
                processedBarcodesRef.current.clear();
                setLastScanned(null);
            }
        });
    };

    const handleManualEntry = (e) => { e.preventDefault(); if (barcodeInput) { if (manualInputDebounceRef.current) clearTimeout(manualInputDebounceRef.current); processBarcode(barcodeInput); setBarcodeInput(''); } };
    
    const handleOnLoanUpload = (file) => {
        if (!file) return;
        setIsBulkLoading(true);
        setError('');
        const reader = new FileReader();
        const fileExtension = file.name.split('.').pop().toLowerCase();

        reader.onload = (e) => {
            try {
                let barcodes = [];
                if (fileExtension === 'txt') {
                    barcodes = e.target.result.split(/\r?\n/).filter(line => line.trim() !== '');
                } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                    if (!isXlsxReady) {
                        setError("Excel kütüphanesi henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin.");
                        setIsBulkLoading(false);
                        return;
                    }
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    barcodes = json.map(row => row[0]).filter(barcode => barcode !== null && barcode !== undefined && String(barcode).trim() !== '');
                }
                
                const uploadedBarcodes = new Set(barcodes.map(b => String(b).trim().replace(/[^0-9]/g, '')).filter(Boolean));

                const newScanResults = Array.from(uploadedBarcodes).map(barcode => {
                    const itemData = kohaDataMap.get(barcode);
                    processedBarcodesRef.current.add(barcode); // Ensure it's marked as processed
                    return {
                        barcode: barcode,
                        isValid: false,
                        warnings: [WARNING_DEFINITIONS.onLoan], // Always set the warning to "onLoan"
                        data: itemData,
                        timestamp: new Date().toISOString()
                    };
                });

                setScannedItems(prevItems => {
                    // Remove any previous scans of the same barcodes from the list
                    const otherItems = prevItems.filter(item => !uploadedBarcodes.has(item.barcode));
                    // Add the new 'onLoan' scans to the front of the list
                    return [...newScanResults, ...otherItems];
                });


            } catch (err) {
                setError(`Güncel ödünç listesi işlenirken hata: ${err.message}`);
            } finally {
                setIsBulkLoading(false);
                setIsNavigatingToSummary(true);
                setTimeout(() => {
                    setPage('summary');
                    setIsNavigatingToSummary(false);
                }, 1500);
            }
        };
        reader.onerror = () => {
            setError("Dosya okuma başarısız oldu.");
            setIsBulkLoading(false);
        };

        if (fileExtension === 'txt') {
            reader.readAsText(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            reader.readAsArrayBuffer(file);
        } else {
            setError("Lütfen geçerli bir .txt veya .xlsx dosyası yükleyin.");
            setIsBulkLoading(false);
        }
    };


    const filteredScannedItems = useMemo(() => scannedItems.filter(item => (searchTerm ? (item.barcode.includes(searchTerm) || String(item.data?.['eser_adi'] || '').toLowerCase().includes(searchTerm.toLowerCase())) : true) && (warningFilter === 'all' ? true : item.warnings.some(w => w.id === warningFilter))), [scannedItems, searchTerm, warningFilter]);

    // --- Report Generation ---
    // Functions to generate and download reports in TXT and XLSX formats.
    const downloadTxt = (data, filename) => { const blob = new Blob([data], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); };
    const downloadXlsx = (data, filename) => { if (!isXlsxReady) { alert("Excel kütüphanesi hazır değil."); return; } const ws = window.XLSX.utils.json_to_sheet(data); const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "Rapor"); window.XLSX.writeFile(wb, filename); };
    
    // Configuration for pre-analysis reports (based on initial Excel file)
    const PRE_ANALYSIS_REPORTS_CONFIG = useMemo(() => [
        { 
            id: 'preOnLoan', 
            title: 'Ödünçteki Materyaller', 
            format: '.xlsx', 
            icon: ICONS.onLoan, 
            description: 'Koha verisine göre halihazırda bir okuyucunun üzerinde ödünçte görünen materyaller.', 
            generator: () => { 
                const data = kohaData.filter(i => String(i['odunc_durumu']) === '1'); 
                downloadXlsx(transformReportData(data), `on_analiz_oduncteki_materyaller_${currentSessionName}.xlsx`); 
            } 
        },
        { 
            id: 'preStatusIssues', 
            title: 'Düşüm / Devir Statüsündeki Materyaller', 
            format: '.xlsx', 
            icon: ICONS.status, 
            description: 'Koha verisine göre materyal statüsü "düşüm" veya "devir" gibi koleksiyon dışı bir durumu gösteren tüm materyaller.', 
            generator: () => { 
                const data = kohaData.filter(i => String(i['materyal_statusu_kodu']) !== '0'); 
                downloadXlsx(transformReportData(data), `on_analiz_dusum_devir_statulu_${currentSessionName}.xlsx`); 
            } 
        },
        { 
            id: 'preNotLoanable', 
            title: 'Ödünç Verilebilirlik Durumu "Ödünç Verilemez" Olan Materyaller', 
            format: '.xlsx', 
            icon: ICONS.notLoanable, 
            description: 'Koha verisine göre Ödünç Verilebilirlik Durumu "Ödünç Verilebilir" Olmayan Tüm Materyaller.', 
            generator: () => { 
                const data = kohaData.filter(i => String(i['odunc_verilebilirlik_kodu']) !== '0'); 
                downloadXlsx(transformReportData(data), `on_analiz_odunc_verilemeyenler_${currentSessionName}.xlsx`); 
            } 
        },
    ], [kohaData, currentSessionName, isXlsxReady]);


    // Configuration for post-scan reports (based on scanned items)
    const POST_SCAN_REPORTS_CONFIG = useMemo(() => [
        { id: 'writeOff', title: 'Düşüm İşlemi İçin Barkodlar (Eksikler)', format: '.txt', icon: ICONS.writeOff, description: "Bu dosya, Koha Materyal Düzeltme/Düşüm Modülü'ne yüklenerek materyallerin topluca düşümünü sağlar.", links: [{ text: 'Koha Düşüm Modülü', url: 'https://personel.ekutuphane.gov.tr/cgi-bin/koha/tools/batchMod.pl' }], notes: ['Sadece Müdür/Yönetici yetkisine sahip personel erişebilir.', 'Yetkisi olmayanlar koha@ktb.gov.tr adresinden talep edebilir.'], generator: () => { const scannedBarcodes = new Set(scannedItems.filter(i => !i.warnings.some(w => w.id === 'duplicate')).map(i => i.barcode)); const missingBarcodes = kohaData.filter(i => String(i['materyal_statusu_kodu']) === '0' && !scannedBarcodes.has(String(i.barkod))).map(i => String(i.barkod).slice(0, 12)); downloadTxt(missingBarcodes.join('\n'), `sayim_sonucu_dusum_icin_eksik_barkodlar_${currentSessionName}.txt`); } },
        { id: 'missing', title: 'Eksik Materyaller', format: '.xlsx', icon: ICONS.missing, description: 'Sayım sırasında hiç okutulmamış olan, kütüphane koleksiyonuna ait materyallerin listesi.', generator: () => { const scannedBarcodes = new Set(scannedItems.filter(i => !i.warnings.some(w => w.id === 'duplicate')).map(i => i.barcode)); const missingItems = kohaData.filter(i => String(i['materyal_statusu_kodu']) === '0' && !scannedBarcodes.has(String(i.barkod))); downloadXlsx(transformReportData(missingItems), `sayim_sonucu_eksik_materyaller_${currentSessionName}.xlsx`); } },
        { id: 'duplicateScans', title: 'Tekrar Okutulan Barkodlar', format: '.xlsx', icon: ICONS.all, description: 'Sayım sırasında birden fazla kez okutulan tüm barkodların listesi. Bu rapor, hem koleksiyon listesinde olan hem de olmayan tekrar okutulmuş barkodları içerir.', generator: () => { const barcodeCounts = scannedItems.reduce((acc, item) => { acc[item.barcode] = (acc[item.barcode] || 0) + 1; return acc; }, {}); const duplicates = Object.entries(barcodeCounts).filter(([, count]) => count > 1).map(([barcode, count]) => { const firstInstance = scannedItems.find(item => item.barcode === barcode); const itemData = firstInstance?.data; const wrongLibWarning = firstInstance.warnings.find(w => w.id === 'wrongLibrary'); return { 'Barkod': barcode, 'Tekrar Sayısı': count, 'Eser Adı': itemData?.['eser_adi'] || 'Bilinmiyor', 'Farklı Kütüphane Adı': wrongLibWarning?.libraryName || '' }; }); downloadXlsx(duplicates, `sayim_sonucu_tekrar_okutulanlar_${currentSessionName}.xlsx`); } },
        { id: 'invalidStructure', title: '❗ Yapıya Uygun Olmayan Barkodlar (Okutulanlar)', format: '.xlsx', icon: ICONS.status, description: 'Sayım sırasında okutulan ve barkod yapısı bilinen hiçbir kütüphane koduna uymayan barkodlar.', generator: () => { const data = scannedItems.filter(i => i.warnings.some(w => w.id === 'invalidStructure')).map(i => ({ Hatalı_Barkod: i.barcode })); downloadXlsx(data, `sayim_sonucu_yapiya_uygun_olmayanlar_${currentSessionName}.xlsx`); } },
        { id: 'deletedScanned', title: '❗ Listede Olmayan ve Sayımı Yapılan Barkodlar', format: '.xlsx', icon: ICONS.status, description: 'Sayım sırasında okutulan ancak Koha\'dan indirilen listede bulunamayan barkodlar (muhtemelen sistemden silinmiş veya hatalı girilmiş).', generator: () => { const data = scannedItems.filter(i => i.warnings.some(w => w.id === 'deleted' || w.id === 'autoCompletedNotFound')).map(i => ({ Barkod: i.barcode, 'Not': 'Okutuldu, listede bulunamadı' })); downloadXlsx(data, `sayim_sonucu_listede_olmayan_okutulanlar_${currentSessionName}.xlsx`); } },
        { id: 'allResults', title: 'Tüm Sayım Sonuçları (Uyarılar Dahil)', format: '.xlsx', icon: ICONS.all, description: 'Sayım boyunca okutulan tüm materyallerin, aldıkları uyarılarla birlikte tam listesi.', generator: () => { const data = scannedItems.map(i => { const wrongLibWarning = i.warnings.find(w => w.id === 'wrongLibrary'); const transformedKohaData = i.data ? transformReportData([i.data])[0] : {}; return { Barkod: i.barcode, 'Eser Adı': i.data?.['eser_adi'] || '', Uyarılar: i.warnings.map(w => w.message || w.text).join(', ') || 'Temiz', 'Farklı Kütüphane Adı': wrongLibWarning?.libraryName || '', ...transformedKohaData }; }); downloadXlsx(data, `sayim_sonucu_tum_sonuclar_${currentSessionName}.xlsx`); } },
        { id: 'cleanList', title: 'Temiz Liste (Uyarısız Okutulanlar)', format: '.xlsx', icon: ICONS.clean, description: 'Sayım sırasında okutulan ve hiçbir uyarı almayan, durumu ve konumu doğru olan materyallerin listesi.', generator: () => { const data = scannedItems.filter(i => i.isValid).map(i => i.data); downloadXlsx(transformReportData(data), `sayim_sonucu_temiz_liste_${currentSessionName}.xlsx`); } },
        { id: 'wrongLibrary', title: 'Kütüphanenize Ait Olmayan ve Okutulan Barkodlar', format: '.xlsx', icon: ICONS.wrongLib, description: 'Sayım sırasında okutulan ancak sayım yapılan kütüphaneye ait olmayan (farklı şube koduna sahip) materyaller.', generator: () => { const data = scannedItems.filter(i => i.warnings.some(w => w.id === 'wrongLibrary')).map(i => { const wrongLibWarning = i.warnings.find(w => w.id === 'wrongLibrary'); return { 'Barkod': i.barcode, 'Ait Olduğu Kütüphane': wrongLibWarning?.libraryName || 'Bilinmiyor' }; }); downloadXlsx(data, `sayim_sonucu_kutuphane_disi_${currentSessionName}.xlsx`); } },
        { id: 'locationMismatch', title: 'Yer Uyumsuzları (Okutulanlar)', format: '.xlsx', icon: ICONS.location, description: 'Sayım sırasında, başlangıçta seçilen lokasyon dışında bir yerde okutulan materyaller.', generator: () => { const data = scannedItems.filter(i => i.warnings.some(w => w.id === 'locationMismatch')).map(i => i.data); downloadXlsx(transformReportData(data), `sayim_sonucu_yer_uyumsuz_${currentSessionName}.xlsx`); } },
    ], [kohaData, scannedItems, currentSessionName, selectedLibrary, isXlsxReady, combinedLibraries]);

    // Calculate summary data for the dashboard and charts
    const summaryData = useMemo(() => {
        if (scannedItems.length === 0 && kohaData.length === 0) return null;
        const STATUS_MAP = { '0': 'Eser Koleksiyonda', '1': 'Düşüm Yapıldı', '2': 'Devir Yapıldı' };
        const materialStatusCounts = kohaData.reduce((acc, item) => {
            const statusCode = String(item['materyal_statusu_kodu']);
            const statusName = STATUS_MAP[statusCode] || `Bilinmeyen Statü (${statusCode})`;
            acc[statusName] = (acc[statusName] || 0) + 1;
            return acc;
        }, {});
        const materialStatusPieData = Object.entries(materialStatusCounts).map(([name, value]) => ({ name, value }));
        const warningCounts = scannedItems.flatMap(item => item.warnings).reduce((acc, warning) => { acc[warning.id] = (acc[warning.id] || 0) + 1; return acc; }, {}); const warningBarData = Object.entries(warningCounts).map(([id, count]) => ({ name: WARNING_DEFINITIONS[id]?.text || id, Sayı: count })); const scanProgress = scannedItems.reduce((acc, item) => { const hour = new Date(item.timestamp).getHours().toString().padStart(2, '0') + ':00'; acc[hour] = (acc[hour] || 0) + 1; return acc; }, {}); const scanProgressData = Object.entries(scanProgress).map(([time, count]) => ({ time, 'Okutulan Sayısı': count })).sort((a,b) => a.time.localeCompare(b.time)); const topErrorLocations = scannedItems.filter(i => i.warnings.length > 0).reduce((acc, item) => { const loc = item.data?.['materyalin_yeri_kodu'] || 'Bilinmeyen'; acc[loc] = (acc[loc] || 0) + 1; return acc; }, {}); const topErrorLocationsData = Object.entries(topErrorLocations).map(([name, count]) => ({ name, 'Hata Sayısı': count })).sort((a, b) => b['Hata Sayısı'] - a['Hata Sayısı']).slice(0, 10); let scanSpeed = 0; if(scannedItems.length > 1){ const firstScanTime = new Date(scannedItems[scannedItems.length - 1].timestamp).getTime(); const lastScanTime = new Date(scannedItems[0].timestamp).getTime(); const durationMinutes = (lastScanTime - firstScanTime) / (1000 * 60); scanSpeed = durationMinutes > 0 ? Math.round(scannedItems.length / durationMinutes) : "∞"; } const activeKohaData = kohaData.filter(item => String(item['materyal_statusu_kodu']) === '0'); const activeScannedItems = scannedItems.filter(item => item.data && String(item.data['materyal_statusu_kodu']) === '0'); const uniqueActiveScannedItems = [...new Map(activeScannedItems.map(item => [item.barcode, item])).values()]; const valid = uniqueActiveScannedItems.filter(item => item.isValid).length; const invalid = uniqueActiveScannedItems.length - valid; const activeKohaBarcodes = new Set(activeKohaData.map(item => String(item.barkod))); const activeScannedBarcodes = new Set(uniqueActiveScannedItems.map(item => item.barcode)); const notScannedCount = [...activeKohaBarcodes].filter(b => !activeScannedBarcodes.has(b)).length; const pieData = [ { name: 'Geçerli', value: valid }, { name: 'Uyarılı', value: invalid }, { name: 'Eksik', value: notScannedCount } ]; const locationStatus = {}; activeKohaData.forEach(item => { const loc = item['materyalin_yeri_kodu'] || 'Bilinmeyen'; if(!locationStatus[loc]) locationStatus[loc] = { 'Geçerli': 0, 'Uyarılı': 0, 'Eksik': 0 }; }); uniqueActiveScannedItems.forEach(item => { const loc = item.data?.['materyalin_yeri_kodu'] || 'Bilinmeyen'; if(!locationStatus[loc]) locationStatus[loc] = { 'Geçerli': 0, 'Uyarılı': 0, 'Eksik': 0 }; if(item.isValid) locationStatus[loc]['Geçerli']++; else locationStatus[loc]['Uyarılı']++; }); const scannedActiveKohaBarcodes = new Set(uniqueActiveScannedItems.map(i => i.barcode)); activeKohaData.forEach(item => { const loc = item['materyalin_yeri_kodu'] || 'Bilinmeyen'; if(!scannedActiveKohaBarcodes.has(String(item.barkod))) { locationStatus[loc]['Eksik']++; } }); const locationStatusData = Object.entries(locationStatus).map(([name, data]) => ({ name, ...data })); return { totalScanned: scannedItems.length, valid, invalid, notScannedCount, scanSpeed, pieData, warningBarData, scanProgressData, locationStatusData, topErrorLocationsData, materialStatusPieData }; }, [scannedItems, kohaData]);
    
    // --- Render Functions ---
    // Maps page state to the corresponding component to render.
    const pageTitles = {
        start: 'Yeni Sayım',
        'pre-reports': 'Ön Raporlar',
        scan: 'Sayım',
        'update-on-loan': 'Güncel Ödünçleri Yükle',
        summary: 'Özet & Raporlar',
        permission: 'Kamera İzni'
    };

    const MobileHeader = ({ onMenuClick, pageTitle }) => (
        <header className="md:hidden bg-white shadow-md p-4 flex items-center justify-between sticky top-0 z-20">
            <button onClick={onMenuClick} className="p-2 text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h2 className="text-lg font-bold text-slate-800">{pageTitle}</h2>
            <div className="w-8"></div> {/* Spacer to balance the title */}
        </header>
    );

    const renderPageContent = () => {
        switch (page) {
            case 'start':
                return <StartScreen sessions={sessions} sessionNameInput={sessionNameInput} setSessionNameInput={setSessionNameInput} startNewSession={startNewSession} error={error} setError={setError} loadSession={loadSession} deleteSession={deleteSession} selectedLibrary={selectedLibrary} setSelectedLibrary={setSelectedLibrary} libraryOptions={libraryOptions} setAddDataModal={setAddDataModal} selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} locationOptions={locationOptions} kohaData={kohaData} handleExcelUpload={handleExcelUpload} isXlsxReady={isXlsxReady} isLoading={isLoading} />;
            case 'pre-reports':
                return <PreReportsScreen {...{ currentSessionName, error, setPage, preAnalysisReports: PRE_ANALYSIS_REPORTS_CONFIG, isXlsxReady }} />;
            case 'update-on-loan':
                return <UpdateOnLoanScreen {...{ handleOnLoanUpload, setPage, isXlsxReady, isLoading: isBulkLoading || isNavigatingToSummary }} />;
            case 'summary':
                return <SummaryScreen {...{ currentSessionName, summaryData, preAnalysisReports: PRE_ANALYSIS_REPORTS_CONFIG, postScanReports: POST_SCAN_REPORTS_CONFIG, isXlsxReady, isHtmlToImageReady }} />;
            case 'scan':
                return <ScanScreen {...{ isCameraOpen, isQrCodeReady, isCameraAllowed, setIsCameraOpen, handleCameraScan, warningModal, currentSessionName, combinedLibraries, selectedLibrary, combinedLocations, selectedLocation, barcodeInput, handleBarcodeInput, handleManualEntry, lastScanned, handleBulkUpload, isBulkLoading, setPage, scannedItems, filteredScannedItems, searchTerm, setSearchTerm, warningFilter, setWarningFilter, handleDeleteItem, handleClearAllScans, fileUploaderKey }} />;
            default:
                return null;
        }
    };
    
    return (
        <div className="font-sans">
            {isNavigatingToSummary && <FullScreenLoader text="Özet & Raporlar Ekranına Geçiliyor..." />}
            {isBulkLoading && <FullScreenLoader text="Toplu Barkodlar Yükleniyor..." progress={bulkProgress} />}
            {isLoading && <FullScreenLoader text="Koha dosyası okunuyor, lütfen bekleyin..." />}
            <WarningModal isOpen={warningModal.isOpen} onClose={() => setWarningModal({ isOpen: false, title: '', warnings: [], barcode: null })} {...warningModal} />
            <ConfirmationModal isOpen={confirmationModal.isOpen} onClose={() => setConfirmationModal({ isOpen: false, message: '', onConfirm: () => {} })} {...confirmationModal} />
            <AddDataModal isOpen={addDataModal.isOpen} onClose={() => setAddDataModal({isOpen: false, type: ''})} onAdd={handleAddCustomData} type={addDataModal.type} />
            <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />
            {installPrompt && showInstallPopup && <InstallPopup onInstall={handleInstallClick} onDismiss={handleDismissInstallPopup} />}
            
            <Sidebar
              page={page}
              setPage={setPage}
              currentSessionName={currentSessionName}
              selectedLibrary={selectedLibrary}
              kohaData={kohaData}
              scannedItems={scannedItems}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              isMobileMenuOpen={isMobileMenuOpen}
              setMobileMenuOpen={setMobileMenuOpen}
              onShare={() => setIsShareModalOpen(true)}
              onInstall={handleInstallClick}
              installPrompt={installPrompt}
            />
            
            <div className="md:ml-64 flex flex-col min-h-screen bg-slate-100">
                {page !== 'permission' && (
                    <MobileHeader
                        onMenuClick={() => setMobileMenuOpen(true)}
                        pageTitle={pageTitles[page]}
                    />
                )}
                <main className="flex-1">
                    {page === 'permission' ? (
                        <PermissionScreen onDecision={handlePermissionDecision} />
                    ) : page === 'scan' ? (
                        <div className="h-full">
                            {renderPageContent()}
                        </div>
                    ) : (
                        <div className="w-full p-4 sm:p-6 md:p-8">
                        {renderPageContent()}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
