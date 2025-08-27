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

        scannedCodesThisSessionRef.current.add(decodedText);
        setMessage({ text: `Başarılı: ${decodedText}`, type: 'success' });
        onScan(decodedText); // Pass the new, unique barcode to the main application

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
    }, [onScan]);

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
  ["12", "ADANA  İL HALK KÜTÜPHANESİ"]	,
["1530", "Adana Adalet Halk Kütüphanesi"]	,
["1317", "Adana Aladağ İlçe Halk Kütüphanesi"]	,
["113", "Adana Ceyhan İlçe Halk Kütüphanesi"]	,
["1310", "Adana Ceyhan Murat Göğebakan Kültür Merkezi Halk Kütüphanesi"]	,
["670", "Adana Feke İlçe Halk Kütüphanesi"]	,
["760", "Adana İmamoğlu Remzi Oğuz Arık İlçe Halk Kütüphanesi"]	,
["1200", "Adana Karacaoğlan Edebiyat Müze Kütüphanesi"]	,
["796", "Adana Karaisalı İlçe Halk Kütüphanesi"]	,
["675", "Adana Kozan Gazi Halk Kütüphanesi"]	,
["114", "Adana Kozan Karacaoğlan İlçe Halk Kütüphanesi"]	,
["1320", "Adana Kozan Özden Kültür Merkezi Halk Kütüphanesi"]	,
["956", "Adana Pozantı İlçe Halk Kütüphanesi"]	,
["499", "Adana Saimbeyli Azmi Yazıcıoğlu İlçe Halk Kütüphanesi"]	,
["1588", "Adana Sarıçam Bebek ve Çocuk Kütüphanesi"]	,
["1007", "Adana Sarıçam İlçe Halk Kütüphanesi"]	,
["763", "Adana Sarıçam İncirlik 100. Yıl Çocuk Kütüphanesi"]	,
["557", "Adana Seyhan Çağdaş Çocuk Kütüphanesi"]	,
["1024", "Adana Seyhan Şakirpaşa Halk Kütüphanesi"]	,
["995", "Adana Seyhan Yusuf Fırat Kotan İlçe Halk Kütüphanesi"]	,
["1071", "Adana Tufanbeyli İlçe Halk Kütüphanesi"]	,
["1135", "Adana Yumurtalık İlçe Halk Kütüphanesi"]	,
["1139", "Adana Yüreğir Hacı Mehmet Sabancı İlçe Halk Kütüphanesi"]	,
["1237", "Adana Yüreğir Kültür Merkezi Çocuk ve Gençlik Kütüphanesi"]	,
["13", "ADIYAMAN  İL HALK KÜTÜPHANESİ"]	,
["560", "Adıyaman Bebek ve Çocuk Kütüphanesi"]	,
["530", "Adıyaman Besni İlçe Halk Kütüphanesi"]	,
["1020", "Adıyaman Besni Suvarlı Halk Kütüphanesi"]	,
["115", "Adıyaman Çelikhan İlçe Halk Kütüphanesi"]	,
["681", "Adıyaman Gerger İlçe Halk Kütüphanesi"]	,
["528", "Adıyaman Gölbaşı Belören Halk Kütüphanesi"]	,
["116", "Adıyaman Gölbaşı İlçe Halk Kütüphanesi"]	,
["117", "Adıyaman Kahta İlçe Halk Kütüphanesi"]	,
["279", "Adıyaman Samsat İlçe Halk Kütüphanesi"]	,
["1003", "Adıyaman Sincik İlçe Halk Kütüphanesi"]	,
["1073", "Adıyaman Tut İlçe Halk Kütüphanesi"]	,
["1573", "Adıyaman Yeşilyurt Halk Kütüphanesi"]	,
["14", "AFYONKARAHİSAR  GEDİK AHMET PAŞA İL HALK KÜTÜPHANESİ"]	,
["521", "Afyonkarahisar Bayat İlçe Halk Kütüphanesi"]	,
["118", "Afyonkarahisar Bolvadin İlçe Halk Kütüphanesi"]	,
["576", "Afyonkarahisar Çay İlçe Halk Kütüphanesi"]	,
["1461", "Afyonkarahisar Çobanlar İlçe Halk Kütüphanesi"]	,
["119", "Afyonkarahisar Dazkırı İlçe Halk Kütüphanesi"]	,
["120", "Afyonkarahisar Dinar İlçe Halk Kütüphanesi"]	,
["604", "Afyonkarahisar Emirdağ Davulga Halk Kütüphanesi"]	,
["647", "Afyonkarahisar Emirdağ İlçe Halk Kütüphanesi"]	,
["1401", "Afyonkarahisar Evciler İlçe Halk Kütüphanesi"]	,
["744", "Afyonkarahisar Hocalar İlçe Halk Kütüphanesi"]	,
["756", "Afyonkarahisar İhsaniye İlçe Halk Kütüphanesi"]	,
["121", "Afyonkarahisar Sandıklı 100. Yıl İlçe Halk Kütüphanesi"]	,
["1002", "Afyonkarahisar Sinanpaşa İlçe Halk Kütüphanesi"]	,
["1037", "Afyonkarahisar Şuhut İlçe Halk Kütüphanesi"]	,
["344", "Afyonkarahisar Sultandağı Dereçine Halk Kütüphanesi"]	,
["1013", "Afyonkarahisar Sultandağı İlçe Halk Kütüphanesi"]	,
["1123", "Afyonkarahisar Sultandağı Yeşilçiftlik Halk Kütüphanesi"]	,
["15", "AĞRI  İL HALK KÜTÜPHANESİ"]	,
["624", "Ağrı Diyadin İlçe Halk Kütüphanesi"]	,
["630", "Ağrı Doğubayazıt İlçe Halk Kütüphanesi"]	,
["644", "Ağrı Eleşkirt İlçe Halk Kütüphanesi"]	,
["726", "Ağrı Hamur İlçe Halk Kütüphanesi"]	,
["1338", "Ağrı Merkez Çocuk Kütüphanesi"]	,
["122", "Ağrı Patnos İlçe Halk Kütüphanesi"]	,
["1044", "Ağrı Taşlıçay İlçe Halk Kütüphanesi"]	,
["1074", "Ağrı Tutak İlçe Halk Kütüphanesi"]	,
["16", "AKSARAY  İL HALK KÜTÜPHANESİ"]	,
["428", "Aksaray Ağaçören İlçe Halk Kütüphanesi"]	,
["660", "Aksaray Eskil İlçe Halk Kütüphanesi"]	,
["704", "Aksaray Gülağaç İlçe Halk Kütüphanesi"]	,
["357", "Aksaray Güzelyurt İlçe Halk Kütüphanesi"]	,
["446", "Aksaray Merkez Kültür Merkezi Çocuk Kütüphanesi"]	,
["1163", "Aksaray Ortaköy İlçe Halk Kütüphanesi"]	,
["980", "Aksaray Sarıyahşi İlçe Halk Kütüphanesi"]	,
["10", "AMASYA  İL HALK KÜTÜPHANESİ"]	,
["700", "Amasya Göynücek İlçe Halk Kütüphanesi"]	,
["123", "Amasya Gümüşhacıköy İlçe Halk Kütüphanesi"]	,
["725", "Amasya Hamamözü İlçe Halk Kütüphanesi"]	,
["88", "Amasya Merzifon İlçe Halk Kütüphanesi"]	,
["1015", "Amasya Suluova İlçe Halk Kütüphanesi"]	,
["1045", "Amasya Taşova İlçe Halk Kütüphanesi"]	,
["1507", "Amasya Ziyaret Halk Kütüphanesi"]	,
["1151", "ANKARA  ADNAN ÖTÜKEN İL HALK KÜTÜPHANESİ"]	,
["1412", "Ankara Akyurt Bebek ve Çocuk Kütüphanesi"]	,
["450", "Ankara Akyurt İlçe Halk Kütüphanesi"]	,
["802", "Ankara Altındağ Bebek ve Çocuk Kütüphanesi"]	,
["1325", "Ankara Altındağ İlçe Halk Kütüphanesi"]	,
["1563", "Ankara Altındağ Mehmet Akif Halk Kütüphanesi"]	,
["684", "Ankara Ayaş Göklerköyü Halk Kütüphanesi"]	,
["402", "Ankara Ayaş İlçe Halk Kütüphanesi"]	,
["510", "Ankara Bala İlçe Halk Kütüphanesi"]	,
["827", "Ankara Bala Kesikköprü Halk Kütüphanesi"]	,
["124", "Ankara Beypazarı M.Akif Ersoy İlçe Halk Kütüphanesi"]	,
["564", "Ankara Çamlıdere İlçe Halk Kütüphanesi"]	,
["126", "Ankara Çankaya Ali Dayı Çocuk Kütüphanesi"]	,
["127", "Ankara Çankaya Balgat Hüseyin Alpar Halk Kütüphanesi"]	,
["1534", "Ankara Çankaya Çayyolu İkipınar Halk Kütüphanesi"]	,
["1570", "Ankara Çankaya Kaygusuz Abdal Alevilik - Bektaşilik İhtisas Kütüphanesi"]	,
["125", "Ankara Çankaya Sevgi Yılı İlçe Halk Kütüphanesi"]	,
["96", "Ankara Cebeci Halk Kütüphanesi"]	,
["1152", "Ankara Cer Modern Sanat Kütüphanesi"]	,
["280", "Ankara Çubuk İlçe Halk Kütüphanesi"]	,
["1153", "Ankara Elmadağ Hasanoğlan 17 Nisan Halk Kütüphanesi"]	,
["645", "Ankara Elmadağ İlçe Halk Kütüphanesi"]	,
["1422", "Ankara Esenboğa Havalimanı Kütüphanesi"]	,
["1356", "Ankara Etimesgut İlçe Halk Kütüphanesi"]	,
["404", "Ankara Evren İlçe Halk Kütüphanesi"]	,
["1421", "Ankara Gar Kütüphanesi"]	,
["936", "Ankara Gölbaşı Eymir Mehmet Halis Bozkurt Halk Kütüphanesi"]	,
["467", "Ankara Gölbaşı Hasan Celal Güzel İlçe Halk Kütüphanesi"]	,
["703", "Ankara Güdül İlçe Halk Kütüphanesi"]	,
["1460", "Ankara Halk Kültürü Araştırmaları Kütüphanesi"]	,
["128", "Ankara Haymana İlçe Halk Kütüphanesi"]	,
["814", "Ankara Kahramankazan İlçe Halk Kütüphanesi"]	,
["785", "Ankara Kalecik İlçe Halk Kütüphanesi"]	,
["1306", "Ankara Keçiören Aktepe Halk Kütüphanesi"]	,
["1558", "Ankara Keçiören Atapark Halk Kütüphanesi"]	,
["1562", "Ankara Keçiören Atatürk Cumhuriyet Kulesi 100. Yıl Halk Kütüphanesi"]	,
["1351", "Ankara Keçiören Bağlum Abdurrahim Karakoç Halk Kütüphanesi"]	,
["1557", "Ankara Keçiören Basınevleri Halk Kütüphanesi"]	,
["1438", "Ankara Keçiören Bebek ve Çocuk Kütüphanesi"]	,
["1259", "Ankara Keçiören Cemil Meriç İlçe Halk Kütüphanesi"]	,
["1435", "Ankara Keçiören Fatih Halk Kütüphanesi"]	,
["1465", "Ankara Keçiören Hüseyin Nihal Atsız Halk Kütüphanesi"]	,
["1354", "Ankara Keçiören Kuşcağız Halk Kütüphanesi"]	,
["1437", "Ankara Keçiören Mehmet Ali Şahin Halk Kütüphanesi"]	,
["1436", "Ankara Keçiören Mehmet Doğan Halk Kütüphanesi"]	,
["1391", "Ankara Keçiören Nata Subayevleri Kütüphanesi (AVM)"]	,
["1355", "Ankara Keçiören Osmanlı Halk Kütüphanesi"]	,
["1483", "Ankara Keçiören Şenay Aybüke Yalçın Halk Kütüphanesi"]	,
["1439", "Ankara Keçiören Yücel Hacaloğlu Halk Kütüphanesi"]	,
["130", "Ankara Kızılcahamam İlçe Halk Kütüphanesi"]	,
["1384", "Ankara Mamak Abidinpaşa Halk Kütüphanesi"]	,
["1451", "Ankara Mamak Akdere Halk Kütüphanesi"]	,
["1470", "Ankara Mamak Altınevler Koleksiyon Kütüphanesi"]	,
["1383", "Ankara Mamak Amfi Halk Kütüphanesi"]	,
["1475", "Ankara Mamak Demirlibahçe Halk Kütüphanesi"]	,
["277", "Ankara Mamak İlçe Halk Kütüphanesi"]	,
["1450", "Ankara Mamak Kıbrısköy Halk Kütüphanesi"]	,
["879", "Ankara Mamak Kutludüğün Halk Kütüphanesi"]	,
["1467", "Ankara Mamak Mutlu Halk Kütüphanesi"]	,
["1390", "Ankara Mamak Nata Ankara Kütüphanesi (AVM)"]	,
["1386", "Ankara Mamak Necip Fazıl Kısakürek Halk Kütüphanesi"]	,
["1382", "Ankara Mamak Şafaktepe Şehitlik Halk Kütüphanesi"]	,
["1398", "Ankara Mamak Üreğil Halk Kütüphanesi"]	,
["1397", "Ankara Mamak Yeşilbayır Bebek ve Çocuk Kütüphanesi"]	,
["1385", "Ankara Mamak Zirvekent Halk Kütüphanesi"]	,
["1192", "Ankara Mehmet Akif Ersoy Edebiyat Müze Kütüphanesi"]	,
["918", "Ankara Nallıhan İlçe Halk Kütüphanesi"]	,
["1381", "Ankara Nuri Pakdil Edebiyat Müze Kütüphanesi"]	,
["2", "Ankara Polatlı İlçe Halk Kütüphanesi"]	,
["281", "Ankara Polatlı Yunusemre Halk Kütüphanesi"]	,
["1342", "Ankara Pursaklar İlçe Halk Kütüphanesi"]	,
["1168", "Ankara Pursaklar Saray Halk Kütüphanesi"]	,
["132", "Ankara Şereflikoçhisar Yunusemre İlçe Halk Kütüphanesi"]	,
["1430", "Ankara Sincan Adalet Halk Kütüphanesi"]	,
["1399", "Ankara Sincan Bebek ve Çocuk Kütüphanesi"]	,
["1343", "Ankara Sincan Evliya Çelebi Halk Kütüphanesi"]	,
["131", "Ankara Sincan İlçe Halk Kütüphanesi"]	,
["1202", "Ankara Sincan Şuayip Çalkın Halk Kütüphanesi"]	,
["1001", "Ankara Sincan Törekent Halk Kütüphanesi"]	,
["363", "Ankara Sincan Yenikent Halk Kütüphanesi"]	,
["1410", "Ankara Telif İhtisas Kütüphanesi"]	,
["1568", "Ankara Ticaret İhtisas Kütüphanesi"]	,
["1267", "Ankara Yenimahalle Abdurrahman Oğultürk Halk Kütüphanesi"]	,
["1274", "Ankara Yenimahalle İlçe Halk Kütüphanesi"]	,
["1204", "Ankara Yenimahalle Şentepe Halk Kütüphanesi"]	,
["17", "ANTALYA  TEKELİOĞLU İL HALK KÜTÜPHANESİ"]	,
["133", "Antalya Akseki Yeğen Mehmet Paşa İlçe Halk Kütüphanesi"]	,
["134", "Antalya Alanya İlçe Halk Kütüphanesi"]	,
["1294", "Antalya Demre İlçe Halk Kütüphanesi"]	,
["1539", "Antalya Döşemealtı Bebek ve Çocuk Kütüphanesi"]	,
["1577", "Antalya Döşemealtı İlçe Halk Kütüphanesi"]	,
["135", "Antalya Elmalı İlçe Halk Kütüphanesi"]	,
["136", "Antalya Finike İlçe Halk Kütüphanesi"]	,
["677", "Antalya Gazipaşa İlçe Halk Kütüphanesi"]	,
["710", "Antalya Gündoğmuş İlçe Halk Kütüphanesi"]	,
["1520", "Antalya Havalimanı Kütüphanesi"]	,
["753", "Antalya İbradı İlçe Halk Kütüphanesi"]	,
["809", "Antalya Kaş Atatürk İlçe Halk Kütüphanesi"]	,
["821", "Antalya Kemer Hilmiye Serin İlçe Halk Kütüphanesi"]	,
["137", "Antalya Korkuteli Fatih İlçe Halk Kütüphanesi"]	,
["873", "Antalya Kumluca İlçe Halk Kütüphanesi"]	,
["90", "Antalya Manavgat İlçe Halk Kütüphanesi"]	,
["1541", "Antalya Manavgat Side Yağhane Turizm ve Seyahat Kütüphanesi"]	,
["894", "Antalya Manavgat Taşağıl Halk Kütüphanesi"]	,
["913", "Antalya Muratpaşa Ahmet Sönmez İlçe Halk Kütüphanesi"]	,
["1582", "Antalya Muratpaşa Millet Bahçesi Halk Kütüphanesi"]	,
["138", "Antalya Serik İlçe Halk Kütüphanesi"]	,
["1359", "Ardahan Çıldır İlçe Halk Kütüphanesi"]	,
["1353", "Ardahan Damal İlçe Halk Kütüphanesi"]	,
["688", "Ardahan Göle İlçe Halk Kütüphanesi"]	,
["727", "Ardahan Hanak 125.Yıl İlçe Halk Kütüphanesi"]	,
["18", "ARDAHAN İL HALK KÜTÜPHANESİ"]	,
["955", "Ardahan Posof İlçe Halk Kütüphanesi"]	,
["19", "ARTVİN  İL HALK KÜTÜPHANESİ"]	,
["472", "Artvin Ardanuç İlçe Halk Kütüphanesi"]	,
["139", "Artvin Arhavi 100. Yıl Nermin Çarmıklı İlçe Halk Kütüphanesi"]	,
["1432", "Artvin Artrium AVM Çocuk Kütüphanesi"]	,
["1352", "Artvin Borçka İlçe Halk Kütüphanesi"]	,
["745", "Artvin Hopa İlçe Halk Kütüphanesi"]	,
["484", "Artvin Merkez Aşağımaden Halk Kütüphanesi"]	,
["914", "Artvin Murgul İlçe Halk Kütüphanesi"]	,
["1028", "Artvin Şavşat İlçe Halk Kütüphanesi"]	,
["1137", "Artvin Yusufeli 100. Yıl İlçe Halk Kütüphanesi"]	,
["5", "AYDIN  İL HALK KÜTÜPHANESİ"]	,
["490", "Aydın Atça Halk Kütüphanesi"]	,
["541", "Aydın Bozdoğan İlçe Halk Kütüphanesi"]	,
["1318", "Aydın Buharkent İlçe Halk Kütüphanesi"]	,
["140", "Aydın Çine İlçe Halk Kütüphanesi"]	,
["1380", "Aydın Efeler İlçe Halk Kütüphanesi"]	,
["141", "Aydın Germencik İlçe Halk Kütüphanesi"]	,
["142", "Aydın İncirliova İlçe Halk Kütüphanesi"]	,
["793", "Aydın Karacasu İlçe Halk kütüphanesi"]	,
["283", "Aydın Karacasu Yenice Halk Kütüphanesi"]	,
["1350", "Aydın Karpuzlu İlçe Halk Kütüphanesi"]	,
["282", "Aydın Koçarlı İlçe Halk Kütüphanesi"]	,
["1519", "Aydın Köşk İlçe Halk Kütüphanesi"]	,
["1297", "Aydın Kültür Merkezi Çocuk Kütüphanesi"]	,
["143", "Aydın Kuşadası İlçe Halk Kütüphanesi"]	,
["284", "Aydın Kuyucak İlçe Halk Kütüphanesi"]	,
["144", "Aydın Nazilli İlçe Halk Kütüphanesi"]	,
["1404", "Aydın Nazilli Kültür Merkezi Kütüphanesi"]	,
["932", "Aydın Ortaklar Halk Kütüphanesi"]	,
["145", "Aydın Söke Hacı Halil Paşa İlçe Halk Kütüphanesi"]	,
["975", "Aydın Söke Sarıkemer Halk Kütüphanesi"]	,
["1014", "Aydın Sultanhisar İlçe Halk Kütüphanesi"]	,
["1116", "Aydın Yenipazar İlçe Halk Kütüphanesi"]	,
["20", "BALIKESİR  İL HALK KÜTÜPHANESİ"]	,
["1148", "Balıkesir Altıeylül İlçe Halk Kütüphanesi"]	,
["146", "Balıkesir Ayvalık İlçe Halk Kütüphanesi"]	,
["147", "Balıkesir Bandırma İlçe Halk Kütüphanesi"]	,
["536", "Balıkesir Bigadiç İlçe Halk Kütüphanesi"]	,
["148", "Balıkesir Burhaniye İlçe Halk Kütüphanesi"]	,
["1141", "Balıkesir Dursunbey Bebek ve Çocuk Kütüphanesi"]	,
["285", "Balıkesir Dursunbey İlçe Halk Kütüphanesi"]	,
["440", "Balıkesir Edremit Akçay İzzet Ege Halk Kütüphanesi"]	,
["149", "Balıkesir Edremit İlçe Halk Kütüphanesi"]	,
["1347", "Balıkesir Gömeç İlçe Halk Kütüphanesi"]	,
["150", "Balıkesir Gönen Ömer Seyfettin İlçe Halk Kütüphanesi"]	,
["735", "Balıkesir Havran Erdem Akpınar İlçe Halk Kütüphanesi"]	,
["775", "Balıkesir İvrindi İlçe Halk Kütüphanesi"]	,
["826", "Balıkesir Kepsut İlçe Halk Kütüphanesi"]	,
["895", "Balıkesir Manyas İlçe Halk Kütüphanesi"]	,
["1489", "Balıkesir Marmara Adası İlçe Halk Kütüphanesi"]	,
["1523", "Balıkesir Marmara Saraylar Halk Kütüphanesi"]	,
["511", "Balıkesir Merkez Altıeylül Çocuk Kütüphanesi"]	,
["512", "Balıkesir Merkez Atatürk Çocuk Kütüphanesi"]	,
["513", "Balıkesir Merkez Ece Amca Çocuk Kütüphanesi"]	,
["514", "Balıkesir Merkez Gaziosmanpaşa Halk Kütüphanesi"]	,
["983", "Balıkesir Savaştepe İlçe Halk Kütüphanesi"]	,
["998", "Balıkesir Sındırgı Piyade Uzman Çavuş Hasan Öztürk İlçe Halk Kütüphanesi"]	,
["1400", "Balıkesir Sultan Alparslan Halk Kütüphanesi"]	,
["1018", "Balıkesir Susurluk İlçe Halk Kütüphanesi"]	,
["21", "BARTIN  İL HALK KÜTÜPHANESİ"]	,
["1495", "Bartın Amasra İlçe Halk Kütüphanesi"]	,
["408", "Bartın Kurucaşile İlçe Halk Kütüphanesi"]	,
["476", "Bartın Merkez Arıt 75. Yıl Halk Kütüphanesi"]	,
["3", "Bartın Ulus Kültür ve Sanatevi"]	,
["22", "BATMAN  ŞEHİT ŞENAY AYBÜKE YALÇIN İL HALK KÜTÜPHANESİ"]	,
["1510", "Batman Ahmet Kaya Şube Halk Kütüphanesi"]	,
["340", "Batman Beşiri İlçe Halk Kütüphanesi"]	,
["1476", "Batman Çocuk Kütüphanesi"]	,
["341", "Batman Gercüş İlçe Halk Kütüphanesi"]	,
["364", "Batman Hasankeyf İlçe Halk Kütüphanesi"]	,
["860", "Batman Kozluk İlçe Halk Kütüphanesi"]	,
["1559", "Batman Merkez Leyla Nasıroğlu Halk Kütüphanesi"]	,
["1201", "Batman Merkez Şube Kütüphanesi"]	,
["1477", "Batman Petrolkent Halk Kütüphanesi"]	,
["1312", "Batman Sason İlçe Halk Kütüphanesi"]	,
["1511", "Batman Yunus Emre Şube Halk Kütüphanesi"]	,
["23", "BAYBURT  İL HALK KÜTÜPHANESİ"]	,
["151", "Bayburt Aydıntepe İlçe Halk Kütüphanesi"]	,
["610", "Bayburt Demirözü İlçe Halk Kütüphanesi"]	,
["24", "BİLECİK  İL HALK KÜTÜPHANESİ"]	,
["105", "Bilecik Bozüyük İlçe Halk Kütüphanesi"]	,
["692", "Bilecik Gölpazarı İlçe Halk Kütüphanesi"]	,
["1552", "Bilecik Osmaneli Bebek ve Çocuk Kütüphanesi"]	,
["934", "Bilecik Osmaneli İlçe Halk Kütüphanesi"]	,
["1188", "Bilecik Pazaryeri İlçe Halk Kütüphanesi"]	,
["1009", "Bilecik Söğüt İlçe Halk Kütüphanesi"]	,
["25", "BİNGÖL 100. YIL İL HALK KÜTÜPHANESİ"]	,
["423", "Bingöl Adaklı İlçe Halk Kütüphanesi"]	,
["366", "Bingöl Genç İlçe Halk Kütüphanesi"]	,
["807", "Bingöl Karlıova İlçe Halk Kütüphanesi"]	,
["832", "Bingöl Kığı İlçe Halk Kütüphanesi"]	,
["365", "Bingöl Solhan İlçe Halk Kütüphanesi"]	,
["1362", "Bingöl Yedisu İlçe Halk Kütüphanesi"]	,
["26", "BİTLİS  İL HALK KÜTÜPHANESİ"]	,
["349", "Bitlis Adilcevaz İlçe Halk Kütüphanesi"]	,
["345", "Bitlis Ahlat İlçe Halk Kütüphanesi"]	,
["1367", "Bitlis Bebek ve Çocuk Kütüphanesi"]	,
["347", "Bitlis Güroymak İlçe Halk Kütüphanesi"]	,
["348", "Bitlis Hizan İlçe Halk Kütüphanesi"]	,
["346", "Bitlis Mutki İlçe Halk Kütüphanesi"]	,
["153", "Bitlis Tatvan İlçe Halk Kütüphanesi"]	,
["27", "BOLU  İL HALK KÜTÜPHANESİ"]	,
["633", "Bolu Dörtdivan İlçe Halk Kütüphanesi"]	,
["154", "Bolu Gerede İlçe Halk Kütüphanesi"]	,
["702", "Bolu Göynük İlçe Halk Kütüphanesi"]	,
["831", "Bolu Kıbrıscık Şehit Kaymakam Muhammed Fatih Safitürk İlçe Halk Kütüphanesi"]	,
["901", "Bolu Mengen 75.Yıl İlçe Halk Kütüphanesi"]	,
["912", "Bolu Mudurnu İlçe Halk Kütüphanesi"]	,
["985", "Bolu Seben İlçe Halk Kütüphanesi"]	,
["1112", "Bolu Yeniçağa İlçe Halk Kütüphanesi"]	,
["8", "BURDUR  İL HALK KÜTÜPHANESİ"]	,
["547", "Burdur Altınyayla İlçe Halk Kütüphanesi"]	,
["109", "Burdur Bucak İlçe Halk Kütüphanesi"]	,
["575", "Burdur Çavdır İlçe Halk Kütüphanesi"]	,
["583", "Burdur Çeltikçi İlçe Halk Kütüphanesi"]	,
["548", "Burdur Çocuk Kütüphanesi"]	,
["689", "Burdur Gölhisar 75.Yıl İlçe Halk Kütüphanesi"]	,
["799", "Burdur Karamanlı İlçe Halk Kütüphanesi"]	,
["822", "Burdur Kemer İlçe Halk Kütüphanesi"]	,
["612", "Burdur Merkez Depremevleri Halk Kütüphanesi"]	,
["859", "Burdur Merkez Kozluca Semih Serdar Özveren Halk Kütüphanesi"]	,
["1050", "Burdur Tefenni İlçe Halk Kütüphanesi"]	,
["439", "Burdur Yeşilova Akçaköy Elif Nine Halk Kütüphanesi"]	,
["1126", "Burdur Yeşilova İlçe Halk kütüphanesi"]	,
["29", "BURSA  İL HALK KÜTÜPHANESİ"]	,
["716", "Bursa Gürsu İlçe Halk Kütüphanesi"]	,
["286", "Bursa İnegöl Çocuk Kütüphanesi"]	,
["157", "Bursa İnegöl İshakpaşa İlçe Halk Kütüphanesi"]	,
["776", "Bursa İznik İlçe Halk Kütüphanesi"]	,
["792", "Bursa Karacabey 100. Yıl Sadık Yılmaz İlçe Halk Kütüphanesi"]	,
["1535", "Bursa Karacabey Sütaş Sadık Yılmaz Halk Kütüphanesi"]	,
["819", "Bursa Keles İlçe Halk Kütüphanesi"]	,
["830", "Bursa Kestel İlçe Halk Kütüphanesi"]	,
["911", "Bursa Mudanya İlçe Halk Kütüphanesi"]	,
["158", "Bursa Mustafakemalpaşa İsmail Hakkı Şenpamukçu İlçe Halk Kütüphanesi"]	,
["923", "Bursa Nilüfer İlçe Halk Kütüphanesi"]	,
["928", "Bursa Orhaneli İlçe Halk Kütüphanesi"]	,
["750", "Bursa Osmangazi Hüsniye Bilsen Halk Kütüphanesi"]	,
["898", "Bursa Osmangazi Mehmet Ali Deniz Halk Kütüphanesi"]	,
["939", "Bursa Osmangazi Ömer Mercan Halk Kütüphanesi"]	,
["1065", "Bursa Osmangazi Tophane Çocuk Kütüphanesi"]	,
["1372", "Bursa Prof. Dr. Süleyman Uludağ ve Prof. Dr. Mustafa Kara Tasavvuf Kültürü ve Edebiyatı Kütüphanesi"]	,
["1119", "Bursa Yenişehir Fatma Göztepe İlçe Halk Kütüphanesi"]	,
["30", "ÇANAKKALE  M.A.ERSOY İL HALK KÜTÜPHANESİ"]	,
["496", "Çanakkale Ayvacık İlçe Halk Kütüphanesi"]	,
["1281", "Çanakkale Bayramiç İlçe Halk Kütüphanesi"]	,
["535", "Çanakkale Biga İlçe Halk Kütüphanesi"]	,
["287", "Çanakkale Bozcaada İlçe Halk Kütüphanesi"]	,
["367", "Çanakkale Çan İlçe Halk Kütüphanesi"]	,
["1214", "Çanakkale Eceabat İlçe Halk Kütüphanesi"]	,
["667", "Çanakkale Ezine İlçe Halk Kütüphanesi"]	,
["159", "Çanakkale Gelibolu İlçe Halk Kütüphanesi"]	,
["160", "Çanakkale Gökçeada İlçe Halk Kütüphanesi"]	,
["409", "Çanakkale Lapseki İlçe Halk Kütüphanesi"]	,
["1087", "Çanakkale Lapseki Umurbey Halk Kütüphanesi"]	,
["1283", "Çanakkale Yenice İlçe Halk Kütüphanesi"]	,
["31", "ÇANKIRI  İL HALK KÜTÜPHANESİ"]	,
["491", "Çankırı Atkaracalar Oğuz İlçe Halk Kütüphanesi"]	,
["525", "Çankırı Bayramören İlçe Halk Kütüphanesi"]	,
["587", "Çankırı Çerkeş İlçe Halk Kütüphanesi"]	,
["368", "Çankırı Eldivan İlçe Halk Kütüphanesi"]	,
["752", "Çankırı Ilgaz İlçe Halk Kütüphanesi"]	,
["840", "Çankırı Kızılırmak İlçe Halk Kütüphanesi"]	,
["854", "Çankırı Korgun 125. Yıl İlçe Halk Kütüphanesi"]	,
["418", "Çankırı Kurşunlu Osman Ekmekçi İlçe Halk Kütüphanesi"]	,
["161", "Çankırı Orta İlçe Halk Kütüphanesi"]	,
["1022", "Çankırı Şabanözü İlçe Halk Kütüphanesi"]	,
["1105", "Çankırı Yapraklı İlçe Halk Kütüphanesi"]	,
["1453", "Çankırı Yaylakent Halk Kütüphanesi"]	,
["32", "ÇORUM  İL HALK KÜTÜPHANESİ"]	,
["452", "Çorum Alaca Alacahöyük Halk Kütüphanesi"]	,
["162", "Çorum Alaca İlçe Halk Kütüphanesi"]	,
["288", "Çorum Bayat İlçe Halk Kütüphanesi"]	,
["539", "Çorum Boğazkale 100. Yıl İlçe Halk Kütüphanesi"]	,
["410", "Çorum Dodurga İlçe Halk Kütüphanesi"]	,
["290", "Çorum Eşref Ertekin Halk Kütüphanesi"]	,
["291", "Çorum Faik Tonguç Çocuk Kütüphanesi"]	,
["163", "Çorum İskilip İlçe Halk Kütüphanesi"]	,
["721", "Çorum Kargı Hacıhamza Halk Kütüphanesi"]	,
["369", "Çorum Kargı Şehit Suat Yaşar İlçe Halk Kütüphanesi"]	,
["883", "Çorum Laçin İlçe Halk Kütüphanesi"]	,
["289", "Çorum Mecitözü İlçe Halk Kütüphanesi"]	,
["164", "Çorum Merkez Hasanpaşa Halk Kütüphanesi"]	,
["899", "Çorum Merkez Mehmet Şadisoğlu Çocuk Kütüphanesi"]	,
["350", "Çorum Oğuzlar İlçe Halk Kütüphanesi"]	,
["933", "Çorum Ortaköy İlçe Halk Kütüphanesi"]	,
["351", "Çorum Osmancık İlçe Halk Kütüphanesi"]	,
["477", "Çorum Sungurlu Arifegazili Halk kütüphanesi"]	,
["165", "Çorum Sungurlu İlçe Halk Kütüphanesi"]	,
["1080", "Çorum Uğurludağ 100. Yıl İlçe Halk Kütüphanesi"]	,
["110", "DEMO EĞİTİM KÜTÜPHANESİ"]	,
["1308", "DEMO EĞİTİM KÜTÜPHANESİ-TEST"]	,
["33", "DENİZLİ 100. YIL İL HALK KÜTÜPHANESİ"]	,
["605", "Denizli Acıpayam Dedebağ Halk Kütüphanesi"]	,
["166", "Denizli Acıpayam İlçe Halk Kütüphanesi"]	,
["818", "Denizli Acıpayam Kelekçi Halk Kütüphanesi"]	,
["1132", "Denizli Acıpayam Yeşilyuva Halk Kütüphanesi"]	,
["370", "Denizli Babadağ Osman Nuri Yılmaz İlçe Halk Kütüphanesi"]	,
["352", "Denizli Baklan İlçe Halk Kütüphanesi"]	,
["353", "Denizli Bekilli İlçe Halk Kütüphanesi"]	,
["532", "Denizli Beyağaç İlçe Halk Kütüphanesi"]	,
["294", "Denizli Bozkurt İlçe Halk Kütüphanesi"]	,
["1528", "Denizli Bozkurt İnceler Halk Kütüphanesi"]	,
["167", "Denizli Buldan Ali Haydar Akın İlçe Halk Kütüphanesi"]	,
["1111", "Denizli Buldan Yenicekent Halk Kütüphanesi"]	,
["442", "Denizli Çal Akkent Halk Kütüphanesi"]	,
["168", "Denizli Çal İlçe Halk Kütüphanesi"]	,
["1581", "Denizli Çameli İlçe Halk Kütüphanesi"]	,
["354", "Denizli Çardak İlçe Halk Kütüphanesi"]	,
["169", "Denizli Çivril İlçe Halk Kütüphanesi"]	,
["292", "Denizli Güney İlçe Halk Kütüphanesi"]	,
["92", "Denizli Honaz İlçe Halk Kütüphanesi"]	,
["781", "Denizli Honaz Kaklık Halk Kütüphanesi"]	,
["295", "Denizli Kale İlçe Halk Kütüphanesi"]	,
["443", "Denizli Pamukkale Akköy Şehit Veli Öztürk Halk Kütüphanesi"]	,
["293", "Denizli Sarayköy İlçe Halk Kütüphanesi"]	,
["170", "Denizli Serinhisar 100. Yıl İlçe Halk Kütüphanesi"]	,
["1048", "Denizli Tavas İlçe Halk Kütüphanesi"]	,
["835", "Denizli Tavas Kızılca Halk Kütüphanesi"]	,
["848", "Denizli Tavas Konak Halk Kütüphanesi"]	,
["1337", "Derleme Kütüphanesi"]	,
["34", "DİYARBAKIR  PROF. DR. FUAT SEZGİN İL HALK KÜTÜPHANESİ"]	,
["1595", "Diyarbakır Adalet Halk Kütüphanesi"]	,
["1185", "Diyarbakır Ahmed Arif Edebiyat Müze Kütüphanesi"]	,
["538", "Diyarbakır Bismil İlçe Halk Kütüphanesi"]	,
["589", "Diyarbakır Çermik İlçe Halk Kütüphanesi"]	,
["591", "Diyarbakır Çınar İlçe Halk Kütüphanesi"]	,
["601", "Diyarbakır Çüngüş İlçe Halk Kütüphanesi"]	,
["619", "Diyarbakır Dicle İlçe Halk Kütüphanesi"]	,
["642", "Diyarbakır Eğil İlçe Halk Kütüphanesi"]	,
["652", "Diyarbakır Ergani İlçe Halk Kütüphanesi"]	,
["1189", "Diyarbakır Esma Ocak Çocuk Kütüphanesi"]	,
["728", "Diyarbakır Hani İlçe Halk Kütüphanesi"]	,
["739", "Diyarbakır Hazro İlçe Halk Kütüphanesi"]	,
["1564", "Diyarbakır Kayapınar İlçe Halk Kütüphanesi"]	,
["845", "Diyarbakır Kocaköy İlçe Halk Kütüphanesi"]	,
["868", "Diyarbakır Kulp İlçe Halk Kütüphanesi"]	,
["886", "Diyarbakır Lice İlçe Halk Kütüphanesi"]	,
["1458", "Diyarbakır Prof. Dr. Aziz Sancar Bebek ve Çocuk Kütüphanesi"]	,
["171", "Diyarbakır Silvan İlçe Halk Kütüphanesi"]	,
["1017", "Diyarbakır Sur Suriçi Halk Kütüphanesi"]	,
["1459", "Diyarbakır Yenişehir Halk Kütüphanesi"]	,
["35", "DÜZCE  İL HALK KÜTÜPHANESİ"]	,
["438", "Düzce Akçakoca İlçe Halk Kütüphanesi"]	,
["343", "Düzce Çilimli İlçe Halk Kütüphanesi"]	,
["1408", "Düzce Cumayeri İlçe Halk Kütüphanesi"]	,
["693", "Düzce Gölyaka İlçe Halk Kütüphanesi"]	,
["1409", "Düzce Gümüşova İlçe Halk Kütüphanesi"]	,
["1263", "Düzce Kaynaşlı İlçe Halk Kütüphanesi"]	,
["1334", "Düzce Merkez Prof. Dr. Necmettin Erbakan Halk Kütüphanesi"]	,
["172", "Düzce Yığılca İlçe Halk Kütüphanesi"]	,
["36", "EDİRNE  İL HALK KÜTÜPHANESİ"]	,
["649", "Edirne Enez İlçe Halk Kütüphanesi"]	,
["736", "Edirne Havsa İlçe Halk Kütüphanesi"]	,
["767", "Edirne İpsala İlçe Halk Kütüphanesi"]	,
["173", "Edirne Keşan İlçe Halk Kütüphanesi"]	,
["884", "Edirne Lalapaşa İlçe Halk Kütüphanesi"]	,
["426", "Edirne Meriç Adasarhanlı Halk Kütüphanesi"]	,
["777", "Edirne Meriç İlçe Halk Kütüphanesi"]	,
["174", "Edirne Merkez Kırkpınar Halk Kütüphanesi"]	,
["1212", "Edirne Süloğlu İlçe Halk Kütüphanesi"]	,
["1092", "Edirne Uzunköprü İlçe Halk Kütüphanesi"]	,
["37", "ELAZIĞ  İL HALK KÜTÜPHANESİ"]	,
["1471", "Elazığ Adalet Halk Kütüphanesi"]	,
["429", "Elazığ Ağın İlçe Halk Kütüphanesi"]	,
["1357", "Elazığ Alacakaya İlçe Halk Kütüphanesi"]	,
["475", "Elazığ Arıcak İlçe Halk Kütüphanesi"]	,
["175", "Elazığ Baskil İlçe Halk Kütüphanesi"]	,
["1309", "Elazığ Karakoçan İlçe Halk Kütüphanesi"]	,
["816", "Elazığ Keban İlçe Halk Kütüphanesi"]	,
["856", "Elazığ Kovancılar İlçe Halk Kütüphanesi"]	,
["1255", "Elazığ Nurettin Ardıçoğlu Kültür Merkezi Çocuk ve Gençlik Kütüphanesi"]	,
["942", "Elazığ Palu Kızılay İlçe Halk Kütüphanesi"]	,
["1005", "Elazığ Sivrice İlçe Halk Kütüphanesi"]	,
["38", "ERZİNCAN 100. YIL İL HALK KÜTÜPHANESİ"]	,
["578", "Erzincan Çayırlı 100. Yıl İlçe Halk Kütüphanesi"]	,
["657", "Erzincan Fatma Sertbaş Bebek ve Çocuk Kütüphanesi"]	,
["758", "Erzincan İliç İlçe Halk Kütüphanesi"]	,
["820", "Erzincan Kemah İlçe Halk Kütüphanesi"]	,
["372", "Erzincan Kemaliye İlçe Halk Kütüphanesi"]	,
["458", "Erzincan Merkez Alpar Kılınç Halk Kütüphanesi"]	,
["1082", "Erzincan Merkez Ulalar Halk Kütüphanesi"]	,
["371", "Erzincan Otlukbeli İlçe Halk Kütüphanesi"]	,
["960", "Erzincan Refahiye İlçe Halk Kütüphanesi"]	,
["1057", "Erzincan Tercan 100. Yıl İlçe Halk Kütüphanesi"]	,
["464", "Erzincan Tercan Altunkent Halk Kütüphanesi"]	,
["902", "Erzincan Tercan Mercan Halk Kütüphanesi"]	,
["1098", "Erzincan Üzümlü İlçe Halk Kütüphanesi"]	,
["39", "ERZURUM  İL HALK KÜTÜPHANESİ"]	,
["485", "Erzurum Aşkale İlçe Halk Kütüphanesi"]	,
["658", "Erzurum Atatürk Kültür Merkezi Kütüphanesi"]	,
["498", "Erzurum Aziziye (Ilıca) İlçe Halk Kütüphanesi"]	,
["570", "Erzurum Çat İlçe Halk Kütüphanesi"]	,
["1235", "Erzurum Çocuk Kütüphanesi"]	,
["1194", "Erzurum Erzurumlu Emrah Edebiyat Müze Kütüphanesi"]	,
["296", "Erzurum Hınıs İlçe Halk Kütüphanesi"]	,
["746", "Erzurum Horasan İlçe Halk Kütüphanesi"]	,
["297", "Erzurum İspir İlçe Halk Kütüphanesi"]	,
["1346", "Erzurum Karaçoban İlçe Halk Kütüphanesi"]	,
["805", "Erzurum Karayazı İlçe Halk Kütüphanesi"]	,
["862", "Erzurum Köprüköy İlçe Halk Kütüphanesi"]	,
["815", "Erzurum Merkez Kazım Karabekir Halk Kütüphanesi"]	,
["921", "Erzurum Narman İlçe Halk Kütüphanesi"]	,
["926", "Erzurum Oltu İlçe Halk Kütüphanesi"]	,
["927", "Erzurum Olur İlçe Halk Kütüphanesi"]	,
["944", "Erzurum Pasinler İlçe Halk Kütüphanesi"]	,
["947", "Erzurum Pazaryolu İlçe Halk Kütüphanesi"]	,
["1031", "Erzurum Şenkaya Şehit Abdulbaki İlçe Halk Kütüphanesi"]	,
["1055", "Erzurum Tekman İlçe Halk Kütüphanesi"]	,
["1068", "Erzurum Tortum Şehit Piyade Teğmen Ahmet AKTEPE İlçe Halk Kütüphanesi"]	,
["1091", "Erzurum Uzundere İlçe Halk Kütüphanesi"]	,
["40", "ESKİŞEHİR  İL HALK KÜTÜPHANESİ"]	,
["459", "Eskişehir Alpu İlçe Halk Kütüphanesi"]	,
["534", "Eskişehir Beylikova İlçe Halk Kütüphanesi"]	,
["594", "Eskişehir Çifteler İlçe Halk Kütüphanesi"]	,
["766", "Eskişehir İnönü İlçe Halk Kütüphanesi"]	,
["889", "Eskişehir Mahmudiye İlçe Halk Kütüphanesi"]	,
["906", "Eskişehir Mihalıçcık Annemin İlçe Halk Kütüphanesi"]	,
["1191", "Eskişehir Odunpazarı İlçe Halk Kütüphanesi"]	,
["996", "Eskişehir Seyitgazi Dr. Ayhan Onursal İlçe Halk Kütüphanesi"]	,
["1006", "Eskişehir Sivrihisar Prof. Dr. Mehmet Kaplan İlçe Halk Kütüphanesi"]	,
["661", "Eskişehir Tepebaşı Dumlupınar Çocuk Kütüphanesi"]	,
["1394", "Eskişehir Tepebaşı Nata Eskişehir Kütüphanesi (AVM)"]	,
["41", "GAZİANTEP  MÜNİFPAŞA 100. YIL İL HALK KÜTÜPHANESİ"]	,
["395", "Gaziantep Araban İlçe Halk Kütüphanesi"]	,
["1313", "Gaziantep İslahiye Altınüzüm Halk Kütüphanesi"]	,
["176", "Gaziantep İslahiye Aziz-Sabiha Bali İlçe Halk Kütüphanesi"]	,
["1211", "Gaziantep İslahiye Yeşilyurt Halk Kütüphanesi"]	,
["412", "Gaziantep Karkamış İlçe Halk Kütüphanesi"]	,
["1500", "Gaziantep Mozaik Halk Kütüphanesi"]	,
["177", "Gaziantep Nizip İlçe Halk Kütüphanesi"]	,
["1086", "Gaziantep Nizip Uluyatır Halk Kütüphanesi"]	,
["924", "Gaziantep Nurdağı İlçe Halk Kütüphanesi"]	,
["411", "Gaziantep Oğuzeli İlçe Halk Kütüphanesi"]	,
["178", "Gaziantep Şahinbey İlçe Halk Kütüphanesi"]	,
["94", "Gaziantep Şehitkamil Bilgi Yılı İlçe Halk Kütüphanesi"]	,
["1106", "Gaziantep Yavuzeli İlçe Halk Kütüphanesi"]	,
["42", "GİRESUN  İL HALK KÜTÜPHANESİ"]	,
["298", "Giresun 125.Yıl Halk Kütüphanesi"]	,
["465", "Giresun Alucra Hulusi Tekışık İlçe Halk Kütüphanesi"]	,
["179", "Giresun Bulancak 75.Yıl İlçe Halk Kütüphanesi"]	,
["1228", "Giresun Çanakçı İlçe Halk Kütüphanesi"]	,
["614", "Giresun Dereli İlçe Halk Kütüphanesi"]	,
["627", "Giresun Doğankent İlçe Halk Kütüphanesi"]	,
["663", "Giresun Espiye İlçe Halk Kütüphanesi"]	,
["666", "Giresun Eynesil İlçe Halk Kütüphanesi"]	,
["698", "Giresun Görele İlçe Halk Kütüphanesi"]	,
["1326", "Giresun Güce İlçe Halk Kütüphanesi"]	,
["180", "Giresun Keşap İlçe Halk Kütüphanesi"]	,
["683", "Giresun Merkez Çocuk Kütüphanesi"]	,
["1571", "Giresun Merkez Valilik Halk Kütüphanesi"]	,
["953", "Giresun Piraziz İlçe Halk Kütüphanesi"]	,
["181", "Giresun Şebinkarahisar Hüseyin Hüsnü Tekışık İlçe Halk Kütüphanesi"]	,
["1060", "Giresun Tirebolu Temel Gündoğdu İlçe Halk Kütüphanesi"]	,
["1101", "Giresun Yağlıdere İlçe Halk Kütüphanesi"]	,
["43", "GÜMÜŞHANE  İL HALK KÜTÜPHANESİ"]	,
["182", "Gümüşhane Kelkit İlçe Halk Kütüphanesi"]	,
["1094", "Gümüşhane Kelkit Ünlüpınar Halk Kütüphanesi"]	,
["864", "Gümüşhane Köse İlçe Halk Kütüphanesi"]	,
["964", "Gümüşhane Köse Salyazı Halk Kütüphanesi"]	,
["1217", "Gümüşhane Kültür Merkezi Şube Kütüphanesi"]	,
["882", "Gümüşhane Kürtün İlçe Halk Kütüphanesi"]	,
["413", "Gümüşhane Şiran İlçe Halk Kütüphanesi"]	,
["1069", "Gümüşhane Torul İlçe Halk Kütüphanesi"]	,
["44", "HAKKARİ  İL HALK KÜTÜPHANESİ"]	,
["598", "Hakkari Çukurca İlçe Halk Kütüphanesi"]	,
["1589", "Hakkari Durankaya Halk Kütüphanesi"]	,
["1590", "Hakkari Esendere Halk Kütüphanesi"]	,
["1030", "Hakkari Şemdinli İlçe Halk Kütüphanesi"]	,
["1138", "Hakkari Yüksekova İlçe Halk Kütüphanesi"]	,
["45", "HATAY  CEMİL MERİÇ İL HALK KÜTÜPHANESİ"]	,
["461", "Hatay Altınözü İlçe Halk Kütüphanesi"]	,
["1049", "Hatay Arsuz İlçe Halk Kütüphanesi"]	,
["527", "Hatay Belen İlçe Halk Kütüphanesi"]	,
["373", "Hatay Dörtyol İlçe Halk Kütüphanesi"]	,
["374", "Hatay Dörtyol Kuzuculu Halk Kütüphanesi"]	,
["1463", "Hatay Dörtyol Özerli Halk Kütüphanesi"]	,
["1456", "Hatay Edebiyat Müze Kütüphanesi"]	,
["414", "Hatay Erzin İlçe Halk Kütüphanesi"]	,
["436", "Hatay Hassa Akbez Halk Kütüphanesi"]	,
["448", "Hatay Hassa Aktepe Halk Kütüphanesi"]	,
["473", "Hatay Hassa Ardıçlı Halk Kütüphanesi"]	,
["734", "Hatay Hassa İlçe Halk Kütüphanesi"]	,
["183", "Hatay İskenderun İlçe Halk Kütüphanesi"]	,
["1329", "Hatay İskenderun Teknik Çocuk ve Gençlik Kütüphanesi"]	,
["1407", "Hatay Kırıkhan Çocuk Kütüphanesi"]	,
["184", "Hatay Kırıkhan N.Ulviye Civelek İlçe Halk Kütüphanesi"]	,
["872", "Hatay Kumlu İlçe Halk Kütüphanesi"]	,
["1124", "Hatay Payas İlçe Halk Kütüphanesi"]	,
["299", "Hatay Reyhanlı İlçe Halk Kütüphanesi"]	,
["965", "Hatay Samandağ İlçe Halk Kütüphanesi"]	,
["1444", "Hatay Vali Rahmi Doğan Halk Kütüphanesi"]	,
["1108", "Hatay Yayladağı İlçe Halk Kütüphanesi"]	,
["46", "IĞDIR 100. YIL İL HALK KÜTÜPHANESİ"]	,
["470", "Iğdır Aralık İlçe Halk Kütüphanesi"]	,
["1536", "Iğdır Karakoyunlu 100. Yıl İlçe Halk Kütüphanesi"]	,
["1596", "Iğdır Söğütlü Halk Kütüphanesi"]	,
["375", "Iğdır Tuzluca İlçe Halk Kütüphanesi"]	,
["47", "ISPARTA  HALİL HAMİT PAŞA İL HALK KÜTÜPHANESİ"]	,
["1550", "Isparta Akkent Halk Kütüphanesi"]	,
["301", "Isparta Aksu İlçe Halk Kütüphanesi"]	,
["486", "Isparta Atabey İslamköy Halk Kütüphanesi"]	,
["487", "Isparta Atabey Mahmut Kıyıcı İlçe Halk Kütüphanesi"]	,
["1548", "Isparta Davraz Halk Kütüphanesi"]	,
["643", "Isparta Eğirdir Barla Halk Kütüphanesi"]	,
["302", "Isparta Eğirdir İlçe Halk Kütüphanesi"]	,
["679", "Isparta Gelendost Bağıllı Aytekin Yılmaz Halk Kütüphanesi"]	,
["300", "Isparta Gelendost Hüseyin Avni Paşa İlçe Halk Kütüphanesi"]	,
["1102", "Isparta Gelendost Yaka Halk Kütüphanesi"]	,
["694", "Isparta Gönen Güneykent Halk Kütüphanesi"]	,
["695", "Isparta Gönen Şehit Öğretmen Selahattin Aysan İlçe Halk Kütüphanesi"]	,
["817", "Isparta Keçiborlu İlçe Halk Kütüphanesi"]	,
["991", "Isparta Keçiborlu Senir Halk Kütüphanesi"]	,
["1469", "Isparta Kültür Merkezi Halk Kütüphanesi"]	,
["1220", "Isparta Merkez Çocuk Kütüphanesi"]	,
["705", "Isparta Merkez Gülistan 75.Yıl Halk Kütüphanesi"]	,
["568", "Isparta Şarkikaraağaç Çarıksaraylar Halk Kütüphanesi"]	,
["592", "Isparta Şarkikaraağaç Çiçekpınar Halk Kütüphanesi"]	,
["685", "Isparta Şarkikaraağaç Göksöğüt Halk Kütüphanesi"]	,
["185", "Isparta Şarkikaraağaç İlçe Halk Kütüphanesi"]	,
["659", "Isparta Senirkent Esendere (Büyükkabaca) Halk Kütüphanesi"]	,
["303", "Isparta Senirkent İlçe Halk Kütüphanesi"]	,
["829", "Isparta Sütçüler Kesme Halk Kütüphanesi"]	,
["1021", "Isparta Sütçüler Yakup Üstün İlçe Halk Kütüphanesi"]	,
["186", "Isparta Uluborlu Alaaddin Keykubat Halk Kütüphanesi"]	,
["1549", "Isparta Vatan Halk Kütüphanesi"]	,
["502", "Isparta Yalvaç Bağkonak Halk Kütüphanesi"]	,
["187", "Isparta Yalvaç Hacı Ali Rıza Efendi İlçe Halk Kütüphanesi"]	,
["871", "Isparta Yalvaç Kumdanlı Halk Kütüphanesi"]	,
["1061", "Isparta Yalvaç Tokmacık Halk Kütüphanesi"]	,
["1117", "Isparta Yenişarbademli İlçe Halk Kütüphanesi"]	,
["48", "İSTANBUL  ORHAN KEMAL İL HALK KÜTÜPHANESİ"]	,
["425", "İstanbul Adalar Büyükada Halk Kütüphanesi"]	,
["742", "İstanbul Adalar Heybeliada Halk Kütüphanesi"]	,
["1480", "İstanbul Adnan Büyükdeniz Dijital Kütüphanesi"]	,
["1455", "İstanbul AKM Sanat Kütüphanesi (VH)"]	,
["1452", "İstanbul Atatürk Kültür Merkezi Sanat Kütüphanesi"]	,
["188", "İstanbul Avcılar İlçe Halk Kütüphanesi"]	,
["1517", "İstanbul Ayasofya Camii Kütüphanesi"]	,
["890", "İstanbul Bağcılar Mahmutbey Halk Kütüphanesi"]	,
["1580", "İstanbul Bahçelievler İlçe Halk Kütüphanesi"]	,
["1181", "İstanbul Bahçelievler Siyavuşpaşa Çocuk Kütüphanesi"]	,
["1503", "İstanbul Bakırköy Doğan Hızlan Halk Kütüphanesi"]	,
["95", "İstanbul Bakırköy Rıfat Ilgaz İlçe Halk Kütüphanesi"]	,
["526", "İstanbul Bayrampaşa Oğuzhan İlçe Halk Kütüphanesi"]	,
["91", "İSTANBUL BEYAZIT DEVLET KÜTÜPHANESİ"]	,
["533", "İstanbul Beykoz Kemalettin Tuğcu İlçe Halk Kütüphanesi"]	,
["1524", "İstanbul Büyükada Edebiyat Müze Kütüphanesi"]	,
["909", "İstanbul Büyükçekmece Mimar Sinan Halk Kütüphanesi"]	,
["572", "İstanbul Çatalca İlçe Halk Kütüphanesi"]	,
["1425", "İstanbul Çekmeköy Adnan Menderes Halk Kütüphanesi"]	,
["1427", "İstanbul Çekmeköy Cezeri Halk Kütüphanesi"]	,
["1426", "İstanbul Çekmeköy Evliya Çelebi Halk Kütüphanesi"]	,
["1485", "İstanbul Çekmeköy Farabi Halk Kütüphanesi"]	,
["1484", "İstanbul Çekmeköy Fuat Sezgin Halk Kütüphanesi"]	,
["1428", "İstanbul Çekmeköy Katip Çelebi Halk Kütüphanesi"]	,
["1424", "İstanbul Çekmeköy Piri Reis İlçe Halk Kütüphanesi"]	,
["1429", "İstanbul Çekmeköy Şehit Fatih Mehmethan Halk Kütüphanesi"]	,
["1481", "İstanbul Esenler 15 Temmuz Millet Kütüphanesi"]	,
["1445", "İstanbul Esenler Dr. Kadir Topbaş İlçe Halk Kütüphanesi"]	,
["1491", "İstanbul Esenler Esma Biltaci Bebek ve Çocuk Kütüphanesi"]	,
["1479", "İstanbul Esenler Halk Kütüphanesi"]	,
["1423", "İstanbul Eyüpsultan Ahmet Kekeç İlçe Halk Kütüphanesi"]	,
["1374", "İstanbul Fatih Abdi Çelebi Kütüphanesi"]	,
["1187", "İstanbul Fatih Ahmet Hamdi Tanpınar Edebiyat Müze Kütüphanesi"]	,
["1433", "İstanbul Fatih Cerrahpaşa Halk Kütüphanesi"]	,
["1544", "İstanbul Fatih Daruşşafaka Kütüphanesi"]	,
["1376", "İstanbul Fatih Dervişali Kütüphanesi"]	,
["1379", "İstanbul Fatih Kadırga Kütüphanesi"]	,
["1377", "İstanbul Fatih Kalenderhane Kütüphanesi"]	,
["1406", "İstanbul Fatih Karagümrük Kütüphanesi"]	,
["1405", "İstanbul Fatih Kasım Günani Kütüphanesi"]	,
["1434", "İstanbul Fatih Merkez Halk Kütüphanesi"]	,
["355", "İstanbul Fatih Refik Halit Karay İlçe Halk Kütüphanesi"]	,
["1545", "İstanbul Fatih Silivrikapı Çocuk Kütüphanesi"]	,
["1468", "İstanbul Fatih Sümbül Efendi Çocuk Kütüphanesi"]	,
["1378", "İstanbul Fatih Topkapı Kütüphanesi"]	,
["1375", "İstanbul Fatih Vani Dergahı Kütüphanesi"]	,
["1501", "İstanbul Fatih Vatan Kütüphanesi"]	,
["1348", "İstanbul Gaziosmanpaşa Çocuk Kütüphanesi"]	,
["1490", "İstanbul Gaziosmanpaşa Farika Halk Kütüphanesi"]	,
["676", "İstanbul Gaziosmanpaşa İlçe Halk Kütüphanesi"]	,
["192", "İstanbul Güngören İlçe Halk Kütüphanesi"]	,
["1364", "İstanbul Havalimanı Kütüphanesi"]	,
["111", "İstanbul Kadıköy Aziz Berker İlçe Halk Kütüphanesi"]	,
["376", "İstanbul Kadıköy Bostancı Serap Sedat Çocuk Kütüphanesi"]	,
["1592", "İstanbul Kadıköy Ömer  Faruk  Toprak  Halk  Kütüphanesi"]	,
["1419", "İstanbul Kağıthane Axis AVM Kütüphanesi"]	,
["558", "İstanbul Kağıthane Çağlayan Halk Kütüphanesi"]	,
["195", "İstanbul Kağıthane Mehmet Akif Ersoy İlçe Halk Kütüphanesi"]	,
["196", "İstanbul Kartal 17 Nisan Halk Kütüphanesi"]	,
["93", "İstanbul Kartal İlçe Halk Kütüphanesi"]	,
["1594", "İstanbul Küçükçekmece Halkalı Halk Kütüphanesi"]	,
["880", "İstanbul Küçükçekmece İlçe Halk Kütüphanesi"]	,
["193", "İstanbul Küçükçekmece Sefaköy Halk Kütüphanesi"]	,
["194", "İstanbul Maltepe Adalet Halk Kütüphanesi"]	,
["1144", "İstanbul Maltepe İlçe Halk Kütüphanesi"]	,
["112", "İstanbul Pendik İlçe Halk Kütüphanesi"]	,
["1340", "İstanbul Prof. Dr. Fuat Sezgin ve Dr. Ursula Sezgin Bilimler Tarihi Kütüphanesi"]	,
["1497", "İSTANBUL RAMİ KÜTÜPHANESİ"]	,
["1420", "İstanbul Sancaktepe Rings AVM Kütüphanesi"]	,
["190", "İstanbul Seyrantepe Halk Kütüphanesi"]	,
["1035", "İstanbul Şile İlçe Halk Kütüphanesi"]	,
["1538", "İstanbul Silivri Barış Manço Çocuk Kütüphanesi"]	,
["1560", "İstanbul Silivri Büyükçavuşlu Kütüphanesi"]	,
["1561", "İstanbul Silivri Hüseyin Nihal Atsız Kütüphanesi"]	,
["198", "İstanbul Silivri İlçe Halk Kütüphanesi"]	,
["1525", "İstanbul Silivri Marmara Adalet Halk Kütüphanesi"]	,
["1392", "İstanbul Silivri Nata Silivri Kütüphanesi (AVM)"]	,
["1543", "İstanbul Silivri Ömer Seyfettin Kütüphanesi"]	,
["1411", "İstanbul Sinema Müzesi Kütüphanesi"]	,
["1327", "İstanbul Sultanbeyli İlçe Halk Kütüphanesi"]	,
["1393", "İstanbul Sultangazi Nata İstanbul Kütüphanesi (AVM)"]	,
["1448", "İstanbul Tuzla Çocuk Kütüphanesi"]	,
["1472", "İstanbul Tuzla İlçe Halk Kütüphanesi"]	,
["1403", "İstanbul Ümraniye Akyaka Park AVM Kütüphanesi"]	,
["1486", "İstanbul Ümraniye İlçe Halk Kütüphanesi"]	,
["1487", "İstanbul Ümraniye Osmangazi Korusu Halk Kütüphanesi"]	,
["1095", "İstanbul Üsküdar Çinili Çocuk Kütüphanesi"]	,
["278", "İstanbul Üsküdar Mihrimah Sultan Çocuk Kütüphanesi"]	,
["200", "İstanbul Üsküdar Selimiye Çocuk Kütüphanesi"]	,
["9", "İstanbul Üsküdar Şemsi Paşa İlçe Halk Kütüphanesi"]	,
["415", "İstanbul Zeytinburnu İlçe Halk Kütüphanesi"]	,
["4", "İZMİR  ATATÜRK İL HALK KÜTÜPHANESİ"]	,
["1482", "İzmir Aliağa Adalet Kütüphanesi"]	,
["304", "İzmir Aliağa İlçe Halk Kütüphanesi"]	,
["1518", "İzmir Alsancak Halk Kütüphanesi"]	,
["1547", "İzmir Alsancak Türk Musikisi İhtisas Kütüphanesi"]	,
["396", "İzmir Balçova İlçe Halk Kütüphanesi"]	,
["522", "İzmir Bayındır İlçe Halk Kütüphanesi"]	,
["524", "İzmir Bayraklı Alpaslan İlçe Halk Kütüphanesi"]	,
["529", "İzmir Bergama İlçe Halk Kütüphanesi"]	,
["305", "İzmir Beydağ İlçe Halk Kütüphanesi"]	,
["201", "İzmir Bornova İlçe Halk Kütüphanesi"]	,
["416", "İzmir Bornova Mehmet Akif Ersoy Çocuk Kütüphanesi"]	,
["1474", "İzmir Buca Adalet Halk Kütüphanesi"]	,
["546", "İzmir Buca İlçe Halk Kütüphanesi"]	,
["1036", "İzmir Buca Osman Nuri Saygın Şirinyer Halk Kütüphanesi"]	,
["590", "İzmir Çeşme İlçe Halk Kütüphanesi"]	,
["377", "İzmir Çiğli İlçe Halk Kütüphanesi"]	,
["565", "İzmir Dikili Çandarlı Halk Kütüphanesi"]	,
["397", "İzmir Dikili İlçe Halk Kütüphanesi"]	,
["1373", "İzmir Edebiyat Müze Kütüphanesi"]	,
["97", "İzmir Foça İlçe Halk Kütüphanesi"]	,
["378", "İzmir Gaziemir İlçe Halk Kütüphanesi"]	,
["791", "İzmir Karabağlar İlçe Halk Kütüphanesi"]	,
["1216", "İzmir Karaburun İlçe Halk Kütüphanesi"]	,
["910", "İzmir Karaburun Mordoğan Halk Kütüphanesi"]	,
["808", "İzmir Karşıyaka Çocuk Kütüphanesi"]	,
["202", "İzmir Karşıyaka Hoca Mithat İlçe Halk Kütüphanesi"]	,
["203", "İzmir Kemalpaşa İlçe Halk Kütüphanesi"]	,
["842", "İzmir Kiraz İlçe Halk Kütüphanesi"]	,
["307", "İzmir Kınık Halk Kütüphanesi"]	,
["1431", "İzmir Menderes İlçe Halk Kütüphanesi"]	,
["900", "İzmir Menemen İlçe Halk Kütüphanesi"]	,
["997", "İzmir Menemen Seyrek Halk Kütüphanesi"]	,
["920", "İzmir Narlıdere İlçe Halk Kütüphanesi"]	,
["937", "İzmir Ödemiş Bademli Halk Kütüphanesi"]	,
["938", "İzmir Ödemiş İlçe Halk Kütüphanesi"]	,
["811", "İzmir Ödemiş Kaymakçı Halk Kütüphanesi"]	,
["850", "İzmir Ödemiş Konaklı Halk Kütüphanesi"]	,
["1396", "İzmir Seferihisar Şehit Kara Pilot Üsteğmen Aykut Yurtsever İlçe Halk Kütüphanesi"]	,
["306", "İzmir Selçuk İlçe Halk Kütüphanesi"]	,
["1059", "İzmir Tire Ahmet Munis Armağan İlçe Halk Kütüphanesi"]	,
["1066", "İzmir Torbalı İlçe Halk Kütüphanesi"]	,
["500", "İzmir Urla Bademler Halk Kütüphanesi"]	,
["1301", "İzmir Urla İlçe Halk Kütüphanesi"]	,
["49", "KAHRAMANMARAŞ  KARACAOĞLAN İL HALK KÜTÜPHANESİ"]	,
["427", "Kahramanmaraş Afşin İlçe Halk Kütüphanesi"]	,
["466", "Kahramanmaraş Andırın Şehit Astsubay Ömer Halisdemir İlçe Halk Kütüphanesi"]	,
["637", "Kahramanmaraş Çağlayancerit Düzbağ Halk Kütüphanesi"]	,
["780", "Kahramanmaraş Çocuk Kütüphanesi"]	,
["1179", "Kahramanmaraş Ekinözü İlçe Halk Kütüphanesi"]	,
["313", "Kahramanmaraş Elbistan İlçe Halk Kütüphanesi"]	,
["686", "Kahramanmaraş Göksun İlçe Halk Kütüphanesi"]	,
["669", "Kahramanmaraş Merkez Fatih Halk Kütüphanesi"]	,
["925", "Kahramanmaraş Nurhak İlçe Halk Kütüphanesi"]	,
["945", "Kahramanmaraş Pazarcık İlçe Halk Kütüphanesi"]	,
["1587", "Kahramanmaraş Şiir Kütüphanesi"]	,
["1077", "Kahramanmaraş Türkoğlu İlçe Halk Kütüphanesi"]	,
["915", "Kahramanmaraş Türkoğlu Mustafa Okumuş Halk Kütüphanesi"]	,
["1127", "Kahramanmaraş Türkoğlu Yeşilyöre Halk Kütüphanesi"]	,
["1586", "Kahramanmaraş Yedi Güzel Adam Halk Kütüphanesi"]	,
["50", "KARABÜK  İL HALK KÜTÜPHANESİ"]	,
["640", "Karabük Eflani İlçe Halk Kütüphanesi"]	,
["358", "Karabük Eskipazar İlçe Halk Kütüphanesi"]	,
["1209", "Karabük Kültür Merkezi Halk Kütüphanesi"]	,
["342", "Karabük Ovacık İlçe Halk Kütüphanesi"]	,
["205", "Karabük Safranbolu İlçe Halk Kütüphanesi"]	,
["935", "Karabük Safranbolu Ovacuma Halk Kütüphanesi"]	,
["379", "Karabük Yenice İlçe Halk Kütüphanesi"]	,
["51", "KARAMAN  KARAMANOĞLU MEHMET BEY İL HALK KÜTÜPHANESİ"]	,
["495", "Karaman Ayrancı İlçe Halk Kütüphanesi"]	,
["655", "Karaman Ermenek Mustafa ve Ayşe Karpuzcu İlçe Halk Kütüphanesi"]	,
["339", "Karaman Kazım Karabekir İlçe Halk Kütüphanesi"]	,
["433", "Karaman Merkez Ahmet Altınay Çocuk Kütüphanesi"]	,
["813", "Karaman Merkez Kayserilioğlu Bebek ve Çocuk Kütüphanesi"]	,
["1554", "Karaman Piri Reis 100. Yıl Halk Kütüphanesi"]	,
["979", "Karaman Sarıveliler Şair Ahmet Tufan Şentürk İlçe Halk Kütüphanesi"]	,
["52", "KARS  İL HALK KÜTÜPHANESİ"]	,
["1488", "Kars Akyaka İlçe Halk Kütüphanesi"]	,
["1349", "Kars Arpaçay İlçe Halk Kütüphanesi"]	,
["362", "Kars Atatürk Çocuk Kütüphanesi"]	,
["620", "Kars Digor İlçe Halk Kütüphanesi"]	,
["779", "Kars Kağızman İlçe Halk Kütüphanesi"]	,
["206", "Kars Sarıkamış İlçe Halk Kütüphanesi"]	,
["989", "Kars Selim İlçe Halk Kütüphanesi"]	,
["1019", "Kars Susuz Halit Paşa İlçe Halk Kütüphanesi"]	,
["53", "KASTAMONU 100. YIL İL HALK KÜTÜPHANESİ"]	,
["420", "Kastamonu Abana İlçe Halk Kütüphanesi"]	,
["431", "Kastamonu Ağlı İlçe Halk Kütüphanesi"]	,
["468", "Kastamonu Araç İlçe Halk Kütüphanesi"]	,
["497", "Kastamonu Azdavay İlçe Halk Kütüphanesi"]	,
["543", "Kastamonu Bozkurt İlçe Halk Kütüphanesi"]	,
["573", "Kastamonu Çatalzeytin İlçe Halk Kütüphanesi"]	,
["555", "Kastamonu Cide İlçe Halk Kütüphanesi"]	,
["602", "Kastamonu Daday İlçe Halk Kütüphanesi"]	,
["618", "Kastamonu Devrekani İlçe Halk Kütüphanesi"]	,
["1415", "Kastamonu Doğanyurt İlçe Halk Kütüphanesi"]	,
["1244", "Kastamonu Hanönü İlçe Halk Kütüphanesi"]	,
["764", "Kastamonu İnebolu İlçe Halk Kütüphanesi"]	,
["1417", "Kastamonu Küre İlçe Halk Kütüphanesi"]	,
["1416", "Kastamonu Pınarbaşı İlçe Halk Kütüphanesi"]	,
["1032", "Kastamonu Şenpazar İlçe Halk Kütüphanesi"]	,
["993", "Kastamonu Seydiler Şehit Şerife Bacı İlçe Halk Kütüphanesi"]	,
["1043", "Kastamonu Taşköprü İlçe Halk Kütüphanesi"]	,
["207", "Kastamonu Tosya İlçe Halk Kütüphanesi"]	,
["430", "Kayseri Akkışla İlçe Halk Kütüphanesi"]	,
["1441", "Kayseri Bünyan Adalet Halk Kütüphanesi"]	,
["550", "Kayseri Bünyan İlçe Halk Kütüphanesi"]	,
["208", "Kayseri Develi Seyrani İlçe Halk Kütüphanesi"]	,
["1158", "Kayseri Felahiye İlçe Halk Kütüphanesi"]	,
["1174", "Kayseri Hacılar İlçe Halk Kütüphanesi"]	,
["54", "KAYSERİ İL HALK KÜTÜPHANESİ"]	,
["762", "Kayseri İncesu İlçe Halk Kütüphanesi"]	,
["1584", "Kayseri Kocasinan Ahi Evran Halk Kütüphanesi"]	,
["1389", "Kayseri Kocasinan Argıncık Halk Kütüphanesi"]	,
["1387", "Kayseri Kocasinan Beyazşehir Halk Kütüphanesi"]	,
["1527", "Kayseri Kocasinan Fevzi Çakmak Halk Kütüphanesi"]	,
["654", "Kayseri Kocasinan İlçe Halk Kütüphanesi"]	,
["1196", "Kayseri Kocasinan Necmettin Feyzioğlu Halk Kütüphanesi"]	,
["1526", "Kayseri Kocasinan Yenişehir Halk Kütüphanesi"]	,
["1388", "Kayseri Kocasinan Ziya Gökalp Halk Kütüphanesi"]	,
["1198", "Kayseri Melikgazi Hisarcık Halk Kütüphanesi"]	,
["1473", "Kayseri Melikgazi İlçe Halk Kütüphanesi"]	,
["1197", "Kayseri Melikgazi Mimarsinan Selçuklu Halk Kütüphanesi"]	,
["1208", "Kayseri Özvatan İlçe Halk Kütüphanesi"]	,
["951", "Kayseri Pınarbaşı İlçe Halk Kütüphanesi"]	,
["1172", "Kayseri Pınarbaşı Pazarören Halk Kütüphanesi"]	,
["978", "Kayseri Sarıoğlan 80.Yıl İlçe Halk Kütüphanesi"]	,
["981", "Kayseri Sarız İlçe Halk Kütüphanesi"]	,
["1038", "Kayseri Talas Fatma-Kemal Timuçin Halk Kütüphanesi"]	,
["1402", "Kayseri Talas İlçe Halk Kütüphanesi"]	,
["1062", "Kayseri Tomarza İlçe Halk Kütüphanesi"]	,
["398", "Kayseri Yahyalı İlçe Halk Kütüphanesi"]	,
["1173", "Kayseri Yeşilhisar İlçe Halk Kütüphanesi"]	,
["1182", "KİLİS  İL HALK KÜTÜPHANESİ"]	,
["1319", "Kilis Elbeyli İlçe Halk Kütüphanesi"]	,
["841", "Kilis Merkez Bebek ve Çocuk Kütüphanesi"]	,
["1521", "Kilis Musabeyli İlçe Halk Kütüphanesi"]	,
["55", "Kırıkkale  İL HALK KÜTÜPHANESİ"]	,
["509", "Kırıkkale Bahşılı İlçe Halk Kütüphanesi"]	,
["515", "Kırıkkale Balışeyh İlçe Halk Kütüphanesi"]	,
["846", "Kırıkkale Balışeyh Koçubaba Halk Kütüphanesi"]	,
["581", "Kırıkkale Çelebi İlçe Halk Kütüphanesi"]	,
["551", "Kırıkkale Delice Büyükavşar Halk Kütüphanesi"]	,
["586", "Kırıkkale Delice Çerikli Halk Kütüphanesi"]	,
["606", "Kırıkkale Delice Doğan Gökkaya İlçe Halk Kütüphanesi"]	,
["1478", "Kırıkkale Ehlibeyt Kütüphanesi"]	,
["797", "Kırıkkale Karakeçili İlçe Halk Kütüphanesi"]	,
["828", "Kırıkkale Keskin İlçe Halk Kütüphanesi"]	,
["731", "Kırıkkale Merkez Hasandede Halk Kütüphanesi"]	,
["1012", "Kırıkkale Sulakyurt İlçe Halk Kütüphanesi"]	,
["380", "Kırıkkale Yahşihan İlçe Halk Kütüphanesi"]	,
["1371", "Kırıkkale Yenimahalle Halk Kütüphanesi"]	,
["56", "Kırklareli  İL HALK KÜTÜPHANESİ"]	,
["460", "Kırklareli Babaeski Alpullu Halk Kütüphanesi"]	,
["209", "Kırklareli Babaeski Görkey İlçe Halk Kütüphanesi"]	,
["1446", "Kırklareli Demirköy İlçe Halk Kütüphanesi"]	,
["434", "Kırklareli Lüleburgaz Ahmetbey Halk Kütüphanesi"]	,
["553", "Kırklareli Lüleburgaz Büyükkarıştıran Halk Kütüphanesi"]	,
["665", "Kırklareli Lüleburgaz Evrensekiz Halk Kütüphanesi"]	,
["210", "Kırklareli Lüleburgaz Sokullu Mehmet Paşa İlçe Halk Kütüphanesi"]	,
["765", "Kırklareli Merkez İnece Halk Kütüphanesi"]	,
["948", "Kırklareli Pehlivanköy İlçe Halk Kütüphanesi"]	,
["309", "Kırklareli Pınarhisar İlçe Halk Kütüphanesi"]	,
["1097", "Kırklareli Vize İlçe Halk Kütüphanesi"]	,
["57", "Kırşehir  AŞIK PAŞA İL HALK KÜTÜPHANESİ"]	,
["1370", "Kırşehir Akçakent İlçe Halk Kütüphanesi"]	,
["310", "Kırşehir Akpınar İlçe Halk Kütüphanesi"]	,
["1164", "Kırşehir Boztepe İlçe Halk Kütüphanesi"]	,
["1167", "Kırşehir Çiçekdağı İlçe Halk Kütüphanesi"]	,
["211", "Kırşehir Kaman İlçe Halk Kütüphanesi"]	,
["875", "Kırşehir Kaman Kurancılı Halk Kütüphanesi"]	,
["940", "Kırşehir Kaman Ömerhacılı Halk Kütüphanesi"]	,
["432", "Kırşehir Merkez Ahi Evran Halk Kütüphanesi"]	,
["212", "Kırşehir Mucur İlçe Halk Kütüphanesi"]	,
["59", "KOCAELİ  İL HALK KÜTÜPHANESİ"]	,
["1466", "Kocaeli Çayırova Akse Halk Kütüphanesi"]	,
["1278", "Kocaeli Çayırova İlçe Halk Kütüphanesi"]	,
["615", "Kocaeli Derince M. Kılıçdoğan İlçe Halk Kütüphanesi"]	,
["1506", "Kocaeli Dilovası Köseler Halk Kütüphanesi"]	,
["1504", "Kocaeli Dilovası Orhangazi Halk Kütüphanesi"]	,
["1505", "Kocaeli Dilovası Turgut Özal Halk Kütüphanesi"]	,
["213", "Kocaeli Gebze İlçe Halk Kütüphanesi"]	,
["214", "Kocaeli Gölcük İlçe Halk Kütüphanesi"]	,
["1502", "Kocaeli Kandıra Adalet Halk Kütüphanesi"]	,
["787", "Kocaeli Kandıra Prof. Turan Güneş İlçe Halk Kütüphanesi"]	,
["215", "Kocaeli Karamürsel İlçe Halk Kütüphanesi"]	,
["1010", "Kocaeli Kartepe İlçe Halk Kütüphanesi"]	,
["863", "Kocaeli Körfez Prof. Dr. Ahmet Haluk Dursun İlçe Halk Kütüphanesi"]	,
["866", "Kocaeli Merkez Köseköy Nazım Demirci Halk Kütüphanesi"]	,
["844", "Kocaeli Merkez Nazmi Oğuz Çocuk Kütüphanesi"]	,
["216", "Kocaeli Merkez Zübeyde Hanım Halk Kütüphanesi"]	,
["60", "KONYA  İL HALK KÜTÜPHANESİ"]	,
["748", "Konya Ahırlı Halk Kütüphanesi"]	,
["1529", "Konya Akören İlçe Halk Kütüphanesi"]	,
["629", "Konya Akşehir Doğrugöz Halk Kütüphanesi"]	,
["217", "Konya Akşehir Tarık Buğra İlçe Halk Kütüphanesi"]	,
["1341", "Konya Altınekin İlçe Halk Kütüphanesi"]	,
["625", "Konya Beyşehir Doğanbey Halk Kütüphanesi"]	,
["218", "Konya Beyşehir İlçe Halk Kütüphanesi"]	,
["1114", "Konya Beyşehir Yenidoğan Halk Kütüphanesi"]	,
["1157", "Konya Bozkır İlçe Halk Kütüphanesi"]	,
["582", "Konya Çeltik İlçe Halk Kütüphanesi"]	,
["556", "Konya Cihanbeyli 75.Yıl İlçe Halk Kütüphanesi"]	,
["600", "Konya Çumra Alibeyhüyüğü Halk Kütüphanesi"]	,
["754", "Konya Çumra İçeriçumra Halk Kütüphanesi"]	,
["219", "Konya Çumra İlçe Halk Kütüphanesi"]	,
["806", "Konya Çumra Karkın Halk Kütüphanesi"]	,
["613", "Konya Derbent İlçe Halk Kütüphanesi"]	,
["626", "Konya Doğanhisar İlçe Halk Kütüphanesi"]	,
["648", "Konya Emirgazi İlçe Halk Kütüphanesi"]	,
["220", "Konya Ereğli İzzettin Süllü İlçe Halk Kütüphanesi"]	,
["1336", "Konya Ereğli Sümer Çocuk Kütüphanesi"]	,
["1150", "Konya Güneysınır İlçe Halk Kütüphanesi"]	,
["722", "Konya Hadim İlçe Halk Kütüphanesi"]	,
["751", "Konya Hüyük İlçe Halk Kütüphanesi"]	,
["1514", "Konya Ilgın Bebek ve Çocuk Kütüphanesi"]	,
["221", "Konya Ilgın Dr. Vefa Tanır İlçe Halk Kütüphanesi"]	,
["311", "Konya Kadınhanı İlçe Halk Kütüphanesi"]	,
["222", "Konya Karapınar İlçe Halk Kütüphanesi"]	,
["803", "Konya Karatay İlçe Halk Kütüphanesi"]	,
["869", "Konya Kulu İlçe Halk Kütüphanesi"]	,
["1358", "Konya Meram Gar Kütüphanesi"]	,
["1413", "Konya Meram İlçe Halk Kütüphanesi"]	,
["381", "Konya Sarayönü İlçe Halk Kütüphanesi"]	,
["988", "Konya Selçuklu İlçe Halk Kütüphanesi"]	,
["223", "Konya Seydişehir İlçe Halk Kütüphanesi"]	,
["994", "Konya Seydişehir Ortakaraören Halk Kütüphanesi"]	,
["492", "Konya Taşkent Avşar Halk Kütüphanesi"]	,
["1039", "Konya Taşkent İlçe Halk Kütüphanesi"]	,
["1075", "Konya Tuzlukçu İlçe Halk Kütüphanesi"]	,
["1207", "Konya Yalıhüyük İlçe Halk Kütüphanesi"]	,
["1136", "Konya Yunak 100. Yıl Atatürk İlçe Halk Kütüphanesi"]	,
["7", "KÜTAHYA  İL HALK KÜTÜPHANESİ"]	,
["224", "Kütahya Altıntaş İlçe Halk Kütüphanesi"]	,
["483", "Kütahya Aslanapa İlçe Halk Kütüphanesi"]	,
["574", "Kütahya Çavdarhisar İlçe Halk Kütüphanesi"]	,
["631", "Kütahya Domaniç İlçe Halk Kütüphanesi"]	,
["635", "Kütahya Dumlupınar İlçe Halk Kütüphanesi"]	,
["646", "Kütahya Emet Gülten-Cevdet Dayıoğlu İlçe Halk Kütüphanesi"]	,
["678", "Kütahya Gediz İlçe Halk Kütüphanesi"]	,
["225", "Kütahya Hisarcık İlçe Halk Kütüphanesi"]	,
["227", "Kütahya Merkez 100.Yıl Çocuk Kütüphanesi"]	,
["1224", "Kütahya Merkez Evliya Çelebi Edebiyat Müze Kütüphanesi"]	,
["226", "Kütahya Merkez Seyit Ömer 75. Yıl Halk Kütüphanesi"]	,
["946", "Kütahya Pazarlar İlçe Halk Kütüphanesi"]	,
["228", "Kütahya Şaphane İlçe Halk Kütüphanesi"]	,
["1566", "Kütahya Simav Bebek Kütüphanesi"]	,
["597", "Kütahya Simav Çitgöl Hüseyin Efendi Halk Kütüphanesi"]	,
["878", "Kütahya Simav Güney Halk Kütüphanesi"]	,
["98", "Kütahya Simav İlçe Halk Kütüphanesi"]	,
["1072", "Kütahya Tavşanlı Tunçbilek Halk Kütüphanesi"]	,
["229", "Kütahya Tavşanlı Zeytinoğlu İlçe Halk Kütüphanesi"]	,
["61", "MALATYA 100. YIL İL HALK KÜTÜPHANESİ"]	,
["437", "Malatya Akçadağ İlçe Halk Kütüphanesi"]	,
["471", "Malatya Arapgir Fethi Gemuhluoğlu İlçe Halk Kütüphanesi"]	,
["474", "Malatya Arguvan İlçe Halk Kütüphanesi"]	,
["520", "Malatya Battalgazi İlçe Halk Kütüphanesi"]	,
["230", "Malatya Darende Sadrazam Mehmet Paşa İlçe Halk Kütüphanesi"]	,
["653", "Malatya Doğanşehir Erkenek Halk Kütüphanesi"]	,
["312", "Malatya Doğanşehir İlçe Halk Kütüphanesi"]	,
["954", "Malatya Doğanşehir Polat Halk Kütüphanesi"]	,
["720", "Malatya Hekimhan Güzelyurt Halk Kütüphanesi"]	,
["740", "Malatya Hekimhan İlçe Halk Kütüphanesi"]	,
["783", "Malatya Kale İlçe Halk Kütüphanesi"]	,
["870", "Malatya Kuluncak İlçe Halk Kütüphanesi"]	,
["1107", "Malatya MalatyaPark AVM Kütüphanesi"]	,
["622", "Malatya Merkez Dilek Halk Kütüphanesi"]	,
["849", "Malatya Merkez Konak Halk Kütüphanesi"]	,
["891", "Malatya Merkez Sabancı Kültür Sitesi Halk Kütüphanesi"]	,
["1240", "Malatya Merkez Sadreddin Konevi Halk Kütüphanesi"]	,
["958", "Malatya Pütürge İlçe Halk Kütüphanesi"]	,
["1109", "Malatya Yazıhan İlçe Halk Kütüphanesi"]	,
["1130", "Malatya Yeşilyurt İlçe Halk Kütüphanesi"]	,
["62", "MANİSA  İL HALK KÜTÜPHANESİ"]	,
["435", "Manisa Ahmetli İlçe Halk Kütüphanesi"]	,
["231", "Manisa Akhisar Zeynelzade İlçe Halk Kütüphanesi"]	,
["457", "Manisa Alaşehir İlçe Halk Kütüphanesi"]	,
["608", "Manisa Demirci 50. Yıl Çocuk Kütüphanesi"]	,
["609", "Manisa Demirci İlçe Halk Kütüphanesi"]	,
["1533", "Manisa Gölmarmara İlçe Halk Kütüphanesi"]	,
["696", "Manisa Gördes M. Nail Akçiçek İlçe Halk Kütüphanesi"]	,
["833", "Manisa Kırkağaç İlçe Halk Kütüphanesi"]	,
["861", "Manisa Köprübaşı İlçe Halk Kütüphanesi"]	,
["867", "Manisa Kula İlçe Halk Kütüphanesi"]	,
["908", "Manisa Merkez Mimar Sinan Çocuk Kütüphanesi"]	,
["424", "Manisa Salihli Adala Halk Kütüphanesi"]	,
["104", "Manisa Salihli İlçe Halk Kütüphanesi"]	,
["972", "Manisa Sarıgöl İlçe Halk Kütüphanesi"]	,
["982", "Manisa Saruhanlı Dr. İbrahim Türek İlçe Halk Kütüphanesi"]	,
["769", "Manisa Şehzadeler Dr. İbrahim Türek Çocuk Kütüphanesi"]	,
["1149", "Manisa Selendi ilçe Halk Kütüphanesi"]	,
["1008", "Manisa Soma İlçe Halk Kütüphanesi"]	,
["1551", "Manisa Turgutlu Bebek ve Çocuk Kütüphanesi"]	,
["232", "Manisa Turgutlu İlçe Halk Kütüphanesi"]	,
["447", "Manisa Yunusemre İlçe Halk Kütüphanesi"]	,
["63", "MARDİN  İL HALK KÜTÜPHANESİ"]	,
["1516", "Mardin Dargeçit 100. Yıl İlçe Halk Kütüphanesi"]	,
["314", "Mardin Derik İlçe Halk Kütüphanesi"]	,
["315", "Mardin Kızıltepe İlçe Halk Kütüphanesi"]	,
["1546", "Mardin Mazıdağı 100. Yıl İlçe Halk Kütüphanesi"]	,
["318", "Mardin Midyat Altunkaya İlçe Halk Kütüphanesi"]	,
["1565", "Mardin Midyat Bebek ve Çocuk Kütüphanesi"]	,
["1553", "Mardin Midyat Millet Bahçesi Halk Kütüphanesi"]	,
["316", "Mardin Nusaybin İlçe Halk Kütüphanesi"]	,
["317", "Mardin Ömerli İlçe Halk Kütüphanesi"]	,
["984", "Mardin Savur İlçe Halk Kütüphanesi"]	,
["1125", "Mardin Yeşilli İlçe Halk Kütüphanesi"]	,
["64", "MERSİN  İL HALK KÜTÜPHANESİ"]	,
["749", "Mersin Akdeniz Huzurkent Halk Kütüphanesi"]	,
["903", "Mersin Akdeniz Merkez Çocuk Kütüphanesi"]	,
["567", "Mersin Anamur Çarıklar Halk kütüphanesi"]	,
["1247", "Mersin Anamur Gençlik ve Çocuk Kütüphanesi"]	,
["233", "Mersin Anamur İlçe Halk Kütüphanesi"]	,
["494", "Mersin Aydıncık İlçe Halk Kütüphanesi"]	,
["545", "Mersin Bozyazı İlçe Halk Kütüphanesi"]	,
["668", "Mersin Çamlıyayla Fakılar Halk Kütüphanesi"]	,
["383", "Mersin Çamlıyayla İlçe Halk Kütüphanesi"]	,
["234", "Mersin Erdemli İlçe Halk Kütüphanesi"]	,
["382", "Mersin Gülnar İlçe Halk Kütüphanesi"]	,
["851", "Mersin Gülnar Konur Halk Kütüphanesi"]	,
["865", "Mersin Gülnar Köseçobanlı Halk Kütüphanesi"]	,
["877", "Mersin Gülnar Kuskan Halk Kütüphanesi"]	,
["673", "Mersin Mezitli Fındıkpınarı Halk Kütüphanesi"]	,
["905", "Mersin Mezitli İlçe (Kuyuluk) Halk Kütüphanesi"]	,
["917", "Mersin Mut İlçe Halk Kütüphanesi"]	,
["235", "Mersin Silifke İlçe Halk Kütüphanesi"]	,
["236", "Mersin Tarsus İlçe Halk Kütüphanesi"]	,
["839", "Mersin Tarsus Kızılçukur Halk Kütüphanesi"]	,
["1110", "Mersin Tarsus Yenice Halk Kütüphanesi"]	,
["480", "Mersin Toroslar Arslanköy Halk Kütüphanesi"]	,
["1067", "Mersin Toroslar İlçe Halk Kütüphanesi"]	,
["1440", "MİLLİ KÜTÜPHANE"]	,
["11", "MUĞLA  HOCA MUSTAFA EFENDİ İL HALK KÜTÜPHANESİ"]	,
["6", "Muğla Bodrum İlçe Halk Kütüphanesi"]	,
["603", "Muğla Dalaman İlçe Halk Kütüphanesi"]	,
["237", "Muğla Datça İlçe Halk Kütüphanesi"]	,
["238", "Muğla Fethiye İlçe Halk Kütüphanesi"]	,
["1443", "Muğla Kavaklıdere İlçe Halk Kütüphanesi"]	,
["239", "Muğla Köyceğiz 75.Yıl İlçe Halk Kütüphanesi"]	,
["240", "Muğla Marmaris İlçe Halk Kütüphanesi"]	,
["1206", "Muğla Menteşe Şehbal Hilmi Şerif Baydur Çocuk Kütüphanesi"]	,
["1120", "Muğla Menteşe Yerkesik Halk Kütüphanesi"]	,
["241", "Muğla Milas İlçe Halk Kütüphanesi"]	,
["930", "Muğla Ortaca İlçe Halk Kütüphanesi"]	,
["1335", "Muğla Seydikemer İlçe Halk Kütüphanesi"]	,
["1081", "Muğla Ula İlçe Halk Kütüphanesi"]	,
["1532", "Muğla Yatağan İlçe Halk Kütüphanesi"]	,
["65", "MUŞ  İL HALK KÜTÜPHANESİ"]	,
["319", "Muş Bulanık İlçe Halk Kütüphanesi"]	,
["1180", "Muş Bulanık Uzgörür Halk Kütüphanesi"]	,
["1184", "Muş Çocuk Kütüphanesi"]	,
["1288", "Muş Hasköy İlçe Halk Kütüphanesi"]	,
["855", "Muş Korkut İlçe Halk Kütüphanesi"]	,
["892", "Muş Malazgirt İlçe Halk Kütüphanesi"]	,
["356", "Muş Varto İlçe Halk Kütüphanesi"]	,
["66", "NEVŞEHİR  İL HALK KÜTÜPHANESİ"]	,
["422", "Nevşehir Acıgöl İlçe Halk Kütüphanesi"]	,
["801", "Nevşehir Acıgöl Karapınar Halk Kütüphanesi"]	,
["1047", "Nevşehir Acıgöl Tatlarin Halk Kütüphanesi"]	,
["552", "Nevşehir Avanos Büyükayhan Halk Kütüphanesi"]	,
["701", "Nevşehir Avanos Göynük Halk Kütüphanesi"]	,
["242", "Nevşehir Avanos İlçe Halk Kütüphanesi"]	,
["782", "Nevşehir Avanos Kalaba Halk Kütüphanesi"]	,
["941", "Nevşehir Avanos Özkonak Halk Kütüphanesi"]	,
["977", "Nevşehir Avanos Sarılar Halk Kütüphanesi"]	,
["1064", "Nevşehir Avanos Topaklı HalkKütüphanesi"]	,
["1513", "Nevşehir Bebek ve Çocuk Kütüphanesi"]	,
["1285", "Nevşehir Derinkuyu İlçe Halk Kütüphanesi"]	,
["708", "Nevşehir Gülşehir Gümüşkent Halk Kütüphanesi"]	,
["794", "Nevşehir Gülşehir Karacaşar Kara Halil Paşa Halk Kütüphanesi"]	,
["243", "Nevşehir Gülşehir Karavezir İlçe Halk Kütüphanesi"]	,
["1169", "Nevşehir Hacıbektaş Avuçköyü Halk Kütüphanesi"]	,
["244", "Nevşehir Hacıbektaş İlçe Halk Kütüphanesi"]	,
["1170", "Nevşehir Hacıbektaş Kızılağıl Halk Kütüphanesi"]	,
["1171", "Nevşehir Hacıbektaş Köşektaş Halk Kütüphanesi"]	,
["1156", "Nevşehir Kozaklı İlçe Halk Kütüphanesi"]	,
["1159", "Nevşehir Kozaklı Karahasanlı Halk Kütüphanesi"]	,
["1160", "Nevşehir Kozaklı Karasenir Halk Kütüphanesi"]	,
["569", "Nevşehir Merkez Çat Halk Kütüphanesi"]	,
["245", "Nevşehir Merkez Damat ibrahim Paşa Halk Kütüphanesi"]	,
["697", "Nevşehir Merkez Göre Halk Kütüphanesi"]	,
["699", "Nevşehir Merkez Göreme Halk Kütüphanesi"]	,
["812", "Nevşehir Merkez Kaymaklı Halk Kütüphanesi"]	,
["919", "Nevşehir Merkez Nar Hacı Osman Ağa Halk Kütüphanesi"]	,
["1078", "Nevşehir Merkez Uçhisar Halk Kütüphanesi"]	,
["1494", "Nevşehir Paşa Konağı Halk Kütüphanesi"]	,
["1177", "Nevşehir Ürgüp Başdere Halk Kütüphanesi"]	,
["916", "Nevşehir Ürgüp Mustafapaşa Halk Kütüphanesi"]	,
["931", "Nevşehir Ürgüp Ortahisar Halk Kütüphanesi"]	,
["1023", "Nevşehir Ürgüp Şahinefendi Halk Kütüphanesi"]	,
["973", "Nevşehir Ürgüp Sarıhıdır Halk Kütüphanesi"]	,
["246", "Nevşehir Ürgüp Tahsinağa İlçe Halk Kütüphanesi"]	,
["1040", "Nevşehir Ürgüp Taşkınpaşa Halk Kütüphanesi"]	,
["67", "NİĞDE  İL HALK KÜTÜPHANESİ"]	,
["463", "Niğde Altunhisar İlçe Halk Kütüphanesi"]	,
["506", "Niğde Bor Bahçeli Halk Kütüphanesi"]	,
["599", "Niğde Bor Çukurkuyu Halk Kütüphanesi"]	,
["247", "Niğde Bor Halil Nuri Bey İlçe Halk Kütüphanesi"]	,
["823", "Niğde Bor Kemerhisar Halk Kütüphanesi"]	,
["836", "Niğde Bor Kızılca Halk Kütüphanesi"]	,
["562", "Niğde Çamardı İlçe Halk Kütüphanesi"]	,
["595", "Niğde Çiftlik İlçe Halk Kütüphanesi"]	,
["1537", "Niğde Kale 100. Yıl Halk Kütüphanesi"]	,
["1508", "Niğde Kayabaşı Halk Kütüphanesi"]	,
["503", "Niğde Merkez Bağlama Halk Kütüphanesi"]	,
["636", "Niğde Merkez Dündarlı Halk Kütüphanesi"]	,
["671", "Niğde Merkez Fertek Hüseyin Avni Göktürk Halk Kütüphanesi"]	,
["709", "Niğde Merkez Gümüşler Halk Kütüphanesi"]	,
["858", "Niğde Merkez Koyunlu Halk Kütüphanesi"]	,
["593", "Niğde Ulukışla Çiftehan Halk Kütüphanesi"]	,
["1085", "Niğde Ulukışla İlçe Halk Kütüphanesi"]	,
["444", "Ordu Akkuş Mesude Efil İlçe Halk Kütüphanesi"]	,
["1314", "Ordu Altınordu İlçe Halk Kütüphanesi"]	,
["322", "Ordu Aybastı İlçe Halk Kütüphanesi"]	,
["563", "Ordu Çamaş İlçe Halk Kütütphanesi"]	,
["1315", "Ordu Çatalpınar İlçe Halk Kütüphanesi"]	,
["321", "Ordu Çaybaşı İlçe Halk Kütüphanesi"]	,
["1365", "Ordu Çocuk Kütüphanesi"]	,
["107", "Ordu Fatsa İlçe Halk Kütüphanesi"]	,
["68", "ORDU GAZİ İL HALK KÜTÜPHANESİ"]	,
["690", "Ordu Gölköy Mehmet Akif Ersoy İlçe Halk Kütüphanesi"]	,
["707", "Ordu Gülyalı Güzide G. Taranoğlu İlçe Halk Kütüphanesi"]	,
["714", "Ordu Gürgentepe İlçe Halk Kütüphanesi"]	,
["757", "Ordu İkizce İlçe Halk Kütüphanesi"]	,
["1369", "Ordu Kabadüz İlçe Halk Kütüphanesi"]	,
["455", "Ordu Kabataş Alankent Halk Kütüphanesi"]	,
["1311", "Ordu Kabataş İlçe Halk Kütüphanesi"]	,
["853", "Ordu Korgan İlçe Halk Kütüphanesi"]	,
["1344", "Ordu Korgan Tepealan Halk Kütüphanesi"]	,
["874", "Ordu Kumru İlçe Halk Kütüphanesi"]	,
["904", "Ordu Mesudiye İlçe Halk Kütüphanesi"]	,
["1122", "Ordu Mesudiye Yeşilce Halk Kütüphanesi"]	,
["384", "Ordu Perşembe İlçe Halk Kütüphanesi"]	,
["1464", "Ordu Ulu Cami Halk Kütüphanesi"]	,
["1084", "Ordu Ulubey İlçe Halk Kütüphanesi"]	,
["1054", "Ordu Ünye Bebek ve Çocuk Kütüphanesi"]	,
["248", "Ordu Ünye İlçe Halk Kütüphanesi"]	,
["1492", "Ordu Ünye Uniport AVM Halk Kütüphanesi"]	,
["69", "OSMANİYE  EMİNE KESKİNER İL HALK KÜTÜPHANESİ"]	,
["505", "Osmaniye Bahçe İlçe Halk Kütüphanesi"]	,
["1585", "Osmaniye Devlet Hastanesi Halk Kütüphanesi"]	,
["385", "Osmaniye Düziçi İlçe Halk Kütüphanesi"]	,
["730", "Osmaniye Hasanbeyli İlçe Halk Kütüphanesi"]	,
["778", "Osmaniye Kadirli İlçe Halk Kütüphanesi"]	,
["1574", "Osmaniye Merkez Fakıuşağı Halk Kütüphanesi"]	,
["1330", "Osmaniye Merkez Tosyalı Halk Kütüphanesi"]	,
["1016", "Osmaniye Sumbas İlçe Halk Kütüphanesi"]	,
["386", "Osmaniye Toprakkale İlçe Halk Kütüphanesi"]	,
["70", "RİZE  İL HALK KÜTÜPHANESİ"]	,
["249", "Rize Ardeşen İlçe Halk Kütüphanesi"]	,
["323", "Rize Çamlıhemşin İlçe Halk Kütüphanesi"]	,
["324", "Rize Çayeli İlçe Halk Kütüphanesi"]	,
["888", "Rize Çayeli Madenli Halk Kütüphanesi"]	,
["325", "Rize Derepazarı İlçe Halk Kütüphanesi"]	,
["328", "Rize Fındıklı İlçe Halk Kütüphanesi"]	,
["713", "Rize Güneysu İlçe Halk Kütüphanesi"]	,
["741", "Rize Hemşin İlçe Halk Kütüphanesi"]	,
["711", "Rize İkizdere İlçe Halk Kütüphanesi"]	,
["326", "Rize İyidere İlçe Halk Kütüphanesi"]	,
["786", "Rize Kalkandere İlçe Halk Kütüphanesi"]	,
["881", "Rize Merkez Kültür Merkezi Halk Kütüphanesi"]	,
["1099", "Rize Merkez Veliköy Halk Kütüphanesi"]	,
["1041", "Rize Muradiye Osman Efendioğlu Halk Kütüphanesi"]	,
["327", "Rize Pazar İlçe Halk Kütüphanesi"]	,
["71", "SAKARYA  İL HALK KÜTÜPHANESİ"]	,
["1576", "Sakarya Adalet Halk Kütüphanesi"]	,
["330", "Sakarya Akyazı Mehmet Niyazi Özdemir İlçe Halk Kütüphanesi"]	,
["1583", "Sakarya Arifiye İlçe Halk Kütüphanesi"]	,
["1462", "Sakarya Ferizli İlçe Halk Kütüphanesi"]	,
["331", "Sakarya Geyve İlçe Halk Kütüphanesi"]	,
["250", "Sakarya Hendek Atatürk İlçe Halk Kütüphanesi"]	,
["1499", "Sakarya Hendek Rasim Paşa Halk Kütüphanesi"]	,
["1418", "Sakarya Karapürçek İlçe Halk Kütüphanesi"]	,
["332", "Sakarya Karasu İlçe Halk Kütüphanesi"]	,
["1339", "Sakarya Kaynarca İlçe Halk Kütüphanesi"]	,
["399", "Sakarya Kemalettin Samipaşa Halk Kütüphanesi"]	,
["843", "Sakarya Kocaali İlçe Halk Kütüphanesi"]	,
["943", "Sakarya Pamukova İlçe Halk Kütüphanesi"]	,
["329", "Sakarya Sapanca İlçe Halk Kütüphanesi"]	,
["333", "Sakarya Söğütlü İlçe Halk Kütüphanesi"]	,
["1454", "Sakarya Taraklı İlçe Halk Kütüphanesi"]	,
["1498", "Sakarya Yenikent Şeyh Edebali Halk Kütüphanesi"]	,
["400", "Samsun 19 Mayıs İlçe Halk Kütüphanesi"]	,
["453", "Samsun Alaçam İlçe Halk Kütüphanesi"]	,
["482", "Samsun Asarcık Şehit Muharrem Konu İlçe Halk Kütüphanesi"]	,
["488", "Samsun Atakum 100. Yıl Gazi İlçe Halk Kütüphanesi"]	,
["1447", "Samsun Ayvacık İlçe Halk Kütüphanesi"]	,
["251", "Samsun Bafra Hasan Çakın İlçe Halk Kütüphanesi"]	,
["252", "Samsun Çarşamba İlçe Halk Kütüphanesi (AVM)"]	,
["72", "SAMSUN GAZİ İL HALK KÜTÜPHANESİ"]	,
["737", "Samsun Havza Atatürk İlçe Halk Kütüphanesi"]	,
["254", "Samsun İlkadım Atatürk İlçe Halk Kütüphanesi"]	,
["810", "Samsun Kavak İlçe Halk Kütüphanesi"]	,
["253", "Samsun Ladik Atatürk İlçe Halk Kütüphanesi"]	,
["1542", "Samsun Müzesi Halk Kütüphanesi"]	,
["963", "Samsun Salıpazarı İlçe Halk Kütüphanesi"]	,
["1053", "Samsun Tekkeköy İlçe Halk Kütüphanesi"]	,
["1058", "Samsun Terme İlçe Halk Kütüphanesi"]	,
["1522", "Samsun Vezirköprü Bebek ve Çocuk Kütüphanesi"]	,
["1333", "Samsun Vezirköprü Çocuk Kütüphanesi"]	,
["255", "Samsun Vezirköprü Fazıl Ahmet Paşa İlçe Halk Kütüphanesi"]	,
["1493", "Samsun Yakakent İlçe Halk Kütüphanesi"]	,
["76", "ŞANLIURFA  İL HALK KÜTÜPHANESİ"]	,
["267", "Şanlıurfa Akçakale İlçe Halk Kütüphanesi"]	,
["537", "Şanlıurfa Birecik İlçe Halk Kütüphanesi"]	,
["544", "Şanlıurfa Bozova İlçe Halk Kütüphanesi"]	,
["1332", "Şanlıurfa Ceylanpınar İlçe Halk Kütüphanesi"]	,
["1363", "Şanlıurfa Çocuk ve Gençlik Kütüphanesi"]	,
["724", "Şanlıurfa Halfeti İlçe Halk Kütüphanesi"]	,
["729", "Şanlıurfa Harran Fikret Otyam İlçe Halk Kütüphanesi"]	,
["268", "Şanlıurfa Hilvan İlçe Halk Kütüphanesi"]	,
["269", "Şanlıurfa Siverek İlçe Halk Kütüphanesi"]	,
["270", "Şanlıurfa Suruç İlçe Halk Kütüphanesi"]	,
["271", "Şanlıurfa Viranşehir İlçe Halk Kütüphanesi"]	,
["73", "SİİRT  İL HALK KÜTÜPHANESİ"]	,
["523", "Siirt Baykan İlçe Halk Kütüphanesi"]	,
["656", "Siirt Eruh İlçe Halk Kütüphanesi"]	,
["1572", "Siirt İbrahim Hakkı Halk Kütüphanesi"]	,
["876", "Siirt Kurtalan İlçe Halk Kütüphanesi"]	,
["1360", "Siirt Merkez 23 Nisan Çocuk Kütüphanesi"]	,
["950", "Siirt Pervari İlçe Halk Kütüphanesi"]	,
["1414", "Siirt Şirvan İlçe Halk Kütüphanesi"]	,
["74", "SİNOP  DR. RIZA NUR İL HALK KÜTÜPHANESİ"]	,
["256", "Sinop Ayancık İlçe Halk Kütüphanesi"]	,
["257", "Sinop Boyabat Y.K. Tengirşenk İlçe Halk Kütüphanesi"]	,
["621", "Sinop Dikmen İlçe Halk Kütüphanesi"]	,
["334", "Sinop Durağan İlçe Halk Kütüphanesi"]	,
["1162", "Sinop Erfelek İlçe Halk Kütüphanesi"]	,
["1322", "Sinop Gerze Atatürk Halk Kütüphanesi"]	,
["258", "Sinop Gerze Münevver Arslan İlçe Halk Kütüphanesi"]	,
["1591", "Sinop Kültür Merkezi Halk Kütüphanesi"]	,
["970", "Sinop Saraydüzü İlçe Halk Kütüphanesi"]	,
["1076", "Sinop Türkeli İlçe Halk Kütüphanesi"]	,
["77", "ŞIRNAK  İL HALK KÜTÜPHANESİ"]	,
["75", "SİVAS  İL HALK KÜTÜPHANESİ"]	,
["441", "Sivas Akıncılar İlçe Halk Kütüphanesi"]	,
["607", "Sivas Altınyayla Deliilyas Halk Kütüphanesi"]	,
["462", "Sivas Altınyayla İlçe Halk Kütüphanesi"]	,
["623", "Sivas Divriği İlçe Halk Kütüphanesi"]	,
["628", "Sivas Doğanşar İlçe Halk Kütüphanesi"]	,
["1449", "Sivas Esentepe Halk Kütüphanesi"]	,
["585", "Sivas Gemerek Çepni Halk Kütüphanesi"]	,
["641", "Sivas Gemerek Eğerci Halk Kütüphanesi"]	,
["680", "Sivas Gemerek İlçe Halk Kütüphanesi"]	,
["999", "Sivas Gemerek Sızır Halk Kütüphanesi"]	,
["1113", "Sivas Gemerek Yeniçubuk Halk Kütüphanesi"]	,
["691", "Sivas Gölova İlçe Halk Kütüphanesi"]	,
["717", "Sivas Gürün İlçe Halk Kütüphanesi"]	,
["1011", "Sivas Gürün Suçatı Halk Kütüphanesi"]	,
["723", "Sivas Hafik İlçe Halk Kütüphanesi"]	,
["761", "Sivas İmranlı İlçe Halk Kütüphanesi"]	,
["451", "Sivas Kangal Alacahan Halk Kütüphanesi"]	,
["788", "Sivas Kangal İlçe Halk Kütüphanesi"]	,
["857", "Sivas Koyulhisar İlçe Halk Kütüphanesi"]	,
["489", "Sivas Merkez Atatürk Çocuk Kütüphanesi"]	,
["634", "Sivas Merkez Dumlupınar Çocuk Kütüphanesi"]	,
["672", "Sivas Merkez Fevzipaşa Çocuk Kütüphanesi"]	,
["1593", "Sivas Sanayi-i Nefise Mektebi Kütüphanesi"]	,
["259", "Sivas Şarkışla İlçe Halk Kütüphanesi"]	,
["1147", "Sivas Suşehri İlçe Halk Kütüphanesi"]	,
["1083", "Sivas Ulaş İlçe Halk Kütüphanesi"]	,
["1133", "Sivas Yıldızeli İlçe Halk Kütüphanesi"]	,
["1140", "Sivas Zara İlçe Halk Kütüphanesi"]	,
["1323", "Şırnak Beytüşşebap İlçe Halk Kütüphanesi"]	,
["1270", "Şırnak Cizre 100. Yıl İlçe Halk Kütüphanesi"]	,
["1345", "Şırnak Güçlükonak İlçe Halk Kütüphanesi"]	,
["755", "Şırnak İdil İlçe Halk Kütüphanesi"]	,
["1000", "Şırnak Silopi İlçe Halk Kütüphanesi"]	,
["1316", "Şırnak Uludere İlçe Halk Kütüphanesi"]	,
["78", "TEKİRDAĞ  NAMIK KEMAL İL HALK KÜTÜPHANESİ"]	,
["588", "Tekirdağ Çerkezköy İlçe Halk Kütüphanesi"]	,
["335", "Tekirdağ Çorlu İlçe Halk Kütüphanesi"]	,
["1100", "Tekirdağ Ergene İlçe Halk Kütüphanesi"]	,
["388", "Tekirdağ Hayrabolu İlçe Halk Kütüphanesi"]	,
["1324", "Tekirdağ Kapaklı İlçe Halk Kütüphanesi"]	,
["1307", "Tekirdağ Malkara İlçe Halk Kütüphanesi"]	,
["387", "Tekirdağ Muratlı İlçe Halk Kütüphanesi"]	,
["968", "Tekirdağ Saray İlçe Halk Kütüphanesi"]	,
["1027", "Tekirdağ Şarköy İlçe Halk Kütüphanesi"]	,
["79", "TOKAT  İL HALK KÜTÜPHANESİ"]	,
["389", "Tokat Almus İlçe Halk Kütüphanesi"]	,
["481", "Tokat Artova İlçe Halk Kütüphanesi"]	,
["519", "Tokat Başçiftlik İlçe Halk Kütüphanesi"]	,
["1366", "Tokat Bebek ve Çocuk Kütüphanesi"]	,
["650", "Tokat Erbaa Şehit Said Uslu İlçe Halk Kütüphanesi"]	,
["261", "Tokat Niksar İlçe Halk Kütüphanesi"]	,
["1575", "Tokat Pazar İlçe Halk Kütüphanesi"]	,
["733", "Tokat Reşadiye Hasanşeyh Halk Kütüphanesi"]	,
["838", "Tokat Reşadiye Kızılcaören Halk Kütüphanesi"]	,
["962", "Tokat Reşadiye Prof. Dr. Nurhan Atasoy İlçe Halk Kütüphanesi"]	,
["1190", "Tokat Sulusaray İlçe Halk Kütüphanesi"]	,
["263", "Tokat Turhal İlçe Halk Kütüphanesi"]	,
["1131", "Tokat Yeşilyurt İlçe Halk Kütüphanesi"]	,
["718", "Tokat Zile Güzelbeyli Halk Kütüphanesi"]	,
["264", "Tokat Zile İlçe Halk Kütüphanesi"]	,
["80", "TRABZON  İL HALK KÜTÜPHANESİ"]	,
["265", "Trabzon Akçaabat İlçe Halk Kütüphanesi"]	,
["469", "Trabzon Araklı İlçe Halk Kütüphanesi"]	,
["479", "Trabzon Arsin İlçe Halk Kütüphanesi"]	,
["531", "Trabzon Beşikdüzü İlçe Halk Kütüphanesi"]	,
["579", "Trabzon Çaykara İlçe Halk Kütüphanesi"]	,
["1070", "Trabzon Çocuk Kütüphanesi"]	,
["638", "Trabzon Düzköy İlçe Halk Kütüphanesi"]	,
["738", "Trabzon Hayrat İlçe Halk Kütüphanesi"]	,
["887", "Trabzon Maçka İlçe Halk Kütüphanesi"]	,
["449", "Trabzon Merkez Akyazı Halk Kütüphanesi"]	,
["1328", "Trabzon Muhibbi Edebiyat Müze Kütüphanesi"]	,
["390", "Trabzon Of İlçe Halk Kütüphanesi"]	,
["682", "Trabzon Şalpazarı Geyikli Halk Kütüphanesi"]	,
["1025", "Trabzon Şalpazarı İlçe Halk Kütüphanesi"]	,
["336", "Trabzon Sürmene 100. Yıl İlçe Halk Kütüphanesi"]	,
["1063", "Trabzon Tonya İlçe Halk Kütüphanesi"]	,
["266", "Trabzon Vakfıkebir İlçe Halk Kütüphanesi"]	,
["1134", "Trabzon Yomra İlçe Halk Kütüphanesi"]	,
["584", "Tunceli Çemişgezek İlçe Halk Kütüphanesi"]	,
["747", "Tunceli Hozat İlçe Halk Kütüphanesi"]	,
["81", "TUNCELİ HÜSEYİN GÜNTAŞ İL HALK KÜTÜPHANESİ"]	,
["896", "Tunceli Mazgirt İlçe Halk Kütüphanesi"]	,
["922", "Tunceli Nazimiye İlçe Halk Kütüphanesi"]	,
["949", "Tunceli Pertek İlçe Halk Kütüphanesi"]	,
["957", "Tunceli Pülümür İlçe Halk Kütüphanesi"]	,
["82", "UŞAK  İSKENDER PALA İL HALK KÜTÜPHANESİ"]	,
["1205", "Uşak Atatürk Çocuk Kütüphanesi"]	,
["554", "Uşak Banaz Büyükoturak Halk Kütüphanesi"]	,
["516", "Uşak Banaz İlçe Halk Kütüphanesi"]	,
["706", "Uşak Eşme Güllü Halk Kütüphanesi"]	,
["664", "Uşak Eşme İlçe Halk Kütüphanesi"]	,
["391", "Uşak Karahallı İlçe Halk Kütüphanesi"]	,
["1090", "Uşak Merkez Uşak Ragıp Soysal Çocuk Kütüphanesi"]	,
["1004", "Uşak Sivaslı İlçe Halk Kütüphanesi"]	,
["986", "Uşak Sivaslı Selçikler Halk Kütüphanesi"]	,
["1046", "Uşak Sivaslı Tatar Halk Kütüphanesi"]	,
["337", "Uşak Ulubey İlçe Halk Kütüphanesi"]	,
["83", "VAN  İL HALK KÜTÜPHANESİ"]	,
["508", "Van Bahçesaray Faki-yi Teyran İlçe Halk Kütüphanesi"]	,
["1279", "Van Başkale İlçe Halk Kütüphanesi"]	,
["1579", "Van Çaldıran Bebek ve Çocuk Kütüphanesi"]	,
["561", "Van Çaldıran İlçe Halk Kütüphanesi"]	,
["571", "Van Çatak 75.Yıl İlçe Halk Kütüphanesi"]	,
["639", "Van Edremit İlçe Halk Kütüphanesi"]	,
["1578", "Van Erciş Bebek ve Çocuk Kütüphanesi"]	,
["651", "Van Erciş İlçe Halk Kütüphanesi"]	,
["1457", "Van Erciş Kültür Merkezi Halk Kütüphanesi"]	,
["1515", "Van Fidanlık Halk Kütüphanesi"]	,
["1368", "Van Gevaş İlçe Halk Kütüphanesi"]	,
["715", "Van Gürpınar İlçe Halk Kütüphanesi"]	,
["1555", "Van İpekyolu Bebek ve Çocuk Kütüphanesi"]	,
["1569", "Van İpekyolu İlçe Halk Kütüphanesi"]	,
["1567", "Van Muradiye Bebek ve Çocuk Kütüphanesi"]	,
["272", "Van Muradiye İlçe Halk Kütüphanesi"]	,
["401", "Van Özalp İlçe Halk Kütüphanesi"]	,
["969", "Van Saray İlçe Halk Kütüphanesi"]	,
["1556", "Van Tuşba İlçe Halk Kütüphanesi"]	,
["84", "YALOVA  İL HALK KÜTÜPHANESİ"]	,
["1331", "Yalova Altınova İlçe Halk Kütüphanesi"]	,
["392", "Yalova Safalı Yılmaz Tüzünataç Çocuk Kütüphanesi"]	,
["1540", "Yalova Termal İlçe Halk Kütüphanesi"]	,
["85", "YOZGAT  İL HALK KÜTÜPHANESİ"]	,
["273", "Yozgat Akmağdeni İlçe Halk Kütüphanesi"]	,
["493", "Yozgat Aydıncık İlçe Halk Kütüphanesi"]	,
["1088", "Yozgat Bebek ve Çocuk Kütüphanesi"]	,
["540", "Yozgat Boğazlıyan Atatürk İlçe Halk Kütüphanesi"]	,
["566", "Yozgat Çandır İlçe Halk Kütüphanesi"]	,
["577", "Yozgat Çayıralan İlçe Halk kütüphanesi"]	,
["580", "Yozgat Çekerek İlçe Halk Kütüphanesi"]	,
["976", "Yozgat Doğankent Halk Kütüphanesi"]	,
["617", "Yozgat Kadışehri İlçe Halk Kütüphanesi"]	,
["971", "Yozgat Saraykent İlçe Halk Kütüphanesi"]	,
["974", "Yozgat Sarıkaya İlçe Halk Kütüphanesi"]	,
["275", "Yozgat Şefaatli Şehit Savaş Akyol İlçe Halk Kütüphanesi Müdürlüğü"]	,
["504", "Yozgat Sorgun Bahadın Halk Kütüphanesi"]	,
["596", "Yozgat Sorgun Çiğdemli Halk Kütüphanesi"]	,
["274", "Yozgat Sorgun İlçe Halk Kütüphanesi"]	,
["1115", "Yozgat Yenifakılı İlçe Halk Kütüphanesi"]	,
["1121", "Yozgat Yerköy İlçe Halk kütüphanesi"]	,
["966", "Yozgat Yerköy Saray Halk Kütüphanesi"]	,
["360", "ZBORATAV HALK KÜLTÜRÜ ARAŞTIRMA KÜTÜPHANESİ (AEGM)"]	,
["359", "ZBORATAV TURİZM İHTİSAS KÜTÜPHANESİ (AEGM)"]	,
["86", "ZONGULDAK  İL HALK KÜTÜPHANESİ"]	,
["456", "Zonguldak Alaplı İlçe Halk Kütüphanesi"]	,
["674", "Zonguldak Çaycuma Filyos Halk Kütüphanesi"]	,
["338", "Zonguldak Çaycuma İlçe Halk Kütüphanesi"]	,
["276", "Zonguldak Devrek İlçe Halk Kütüphanesi"]	,
["89", "Zonguldak Ereğli İlçe Halk Kütüphanesi"]	,
["1512", "Zonguldak Gökçebey İlçe Halk Kütüphanesi"]	,
["1496", "Zonguldak Kilimli İlçe Halk Kütüphanesi"]	,
["1292", "Zonguldak Kozlu İlçe Halk Kütüphanesi"]
];
const INITIAL_LOCATIONS = [
    ["YB", "Yetişkin Bölümü"]	,
["ÇB", "Çocuk Bölümü"]	,
["AB", "Atatürk Bölümü"]	,
["AÖÖK", "Adnan Ötüken Özel Koleksiyonu (Adnan Ötüken İl Halk İçin)"]	,
["Bakanlık Yayınları", "Bakanlık Yayınları (Edebiyat Müze Kütüphaneleri İçin)"]	,
["BB", "Bebek Bölümü (0-3 Yaş)"]	,
["BEYRA", "Rami Yerleşkesi"]	,
["D", "Depo"]	,
["DB", "Danışma Bölümü"]	,
["DG", "Diğer"]	,
["Edebiyat Kuramı", "Edebiyat Kuramı (Edebiyat Müze Kütüphaneleri İçin)"]	,
["EK", "Etkinlik Kitapları Bölümü"]	,
["GAY", "Gezici Kütüphane Anadolu Yakası"]	,
["GB", "Gençlik Bölümü"]	,
["GD1", "Geçici Derme1"]	,
["GD2", "Geçici Derme2"]	,
["GD3", "Geçici Derme3"]	,
["GD4", "Geçici Derme4 (Kurumlar)"]	,
["Gİ", "Gör-İşit Bölümü"]	,
["GK", "Gezici Kütüphane"]	,
["GK2", "Gezici Kütüphane 2"]	,
["IOK", "İlk Okuma Kitapları Bölümü"]	,
["İmzalı Kitaplar", "İmzalı Kitaplar (Edebiyat Müze Kütüphaneleri İçin)"]	,
["KB", "Kataloglama Bölümü"]	,
["KK", "Kent Kitaplığı"]	,
["KOK", "Osmaniye Fakıuşağı Konteyner Kent"]	,
["NE", "Nadir Eserler Bölümü"]	,
["NÖ", "Nobel Ödüllü Kitaplar"]	,
["OÖ", "Okul Öncesi Bölümü"]	,
["RA1", "Atatürk İhtisas (Rami Kütüphanesi)"]	,
["RA10", "Toplum Bilimleri: 142 (Rami Kütüphanesi)"]	,
["RA11", "Dil ve Dil Bilimi: 163 (Rami Kütüphanesi)"]	,
["RA12", "Doğa Bilimleri ve Matematik: 141 (Rami Kütüphanesi)"]	,
["RA13", "Teknoloji ve Uygulamalı Bilimler: 150 (Rami Kütüphanesi)"]	,
["RA14", "Güzel Sanatlar: 153 (Rami Kütüphanesi)"]	,
["RA15", "Edebiyat & Retorik: 154/155 (Rami Kütüphanesi)"]	,
["RA16", "Tarih & Coğrafya: 168 (Rami Kütüphanesi)"]	,
["RA18", "İlk Öğretim Çalışma Salonu (10-14 yaş): 125  (Rami Kütüphanesi)"]	,
["RA19", "Atatürk İhtisas: 114  (Rami Kütüphanesi)"]	,
["RA2", "İlk Öğretim Çalışma Salonu (6-9 yaş): 124  (Rami Kütüphanesi)"]	,
["RA20", "Atatürk İhtisas: 115 (Rami Kütüphanesi)"]	,
["RA21", "Biyografi Kitaplığı: 118 (Rami Kütüphanesi)"]	,
["RA22", "Günay-Turgut Kut İhtisas Kitaplığı (Yazma Eserler Okuma Salonu): 177 (Rami Kütüphanesi)"]	,
["RA23", "Engelsiz Bilgi Merkezi: 148 (Rami Kütüphanesi)"]	,
["RA3", "Bebek Kütüphanesi (Masal 0-3 yaş): 126/127 (Rami Kütüphanesi)"]	,
["RA4", "Lise Hazırlık: 129/130 (Rami Kütüphanesi)"]	,
["RA5", "Üniversite Hazırlık: 134 (Rami Kütüphanesi)"]	,
["RA7", "Genel Konular: 156 (Rami Kütüphanesi)"]	,
["RA8", "Psikoloji ve Felsefe: 139 (Rami Kütüphanesi)"]	,
["RA9", "Din: 146 (Rami Kütüphanesi)"]	,
["S", "Salon"]	,
["SAM", "Şehir Araştırmaları Merkezi"]	,
["SB", "Sanat Bölümü"]	,
["SY", "Süreli Yayınlar Bölümü"]	,
["TEDA Kitapları", "TEDA Kitapları"]	,
["Türk Edebiyatı", "Türk Edebiyatı (Edebiyat Müze Kütüphaneleri İçin)"]
];
const WARNING_DEFINITIONS = { 
    invalidStructure: { id: 'invalidStructure', text: 'Yapıya Uygun Olmayan', color: '#E74C3C', sound: 'A#3', message: 'Okutulan barkod gerekli yapıyla eşleşmiyor.' }, 
    locationMismatch: { id: 'locationMismatch', text: 'Konum Farklı', color: '#FAD7A0', sound: 'C4', message: 'Okutulan materyal seçilen lokasyonda bulunmuyor.' }, 
    notLoanable: { id: 'notLoanable', text: 'Ödünç Verilemez', color: '#F08080', sound: 'E5', message: "Materyalin ödünç verilebilirlik durumu uygun değil." }, 
    notInCollection: { id: 'notInCollection', text: 'Düşüm/Devir', color: '#A9C9F5', sound: 'G4', message: 'Materyal koleksiyonda değil (düşüm veya devir yapılmış).' }, 
    onLoan: { id: 'onLoan', text: 'Okuyucuda', color: '#F7B38D', sound: 'C4', message: 'Materyal şu anda ödünçte ve iade edilmesi gerekiyor.' }, 
    wrongLibrary: { id: 'wrongLibrary', text: 'Farklı Kütüphane', color: '#C7AED9', sound: 'C4', message: 'Materyal sizin kütüphanenize ait değil.' }, 
    deleted: { id: 'deleted', text: 'Listede Yok', color: '#808080', sound: 'A3', message: 'Barkod formatı doğru ancak içeri aktarılan listede bulunamadı.' }, 
    autoCompletedNotFound: { id: 'autoCompletedNotFound', text: 'Manuel Girilen Bulunamadı', color: '#8E44AD', sound: 'A3', message: 'Barkod 12 haneye tamamlandı ancak içeri aktardığınız listede bulunamadı. Lütfen materyal barkodunu kontrol edin.' }, 
    duplicate: { id: 'duplicate', text: 'Tekrar Okutuldu', color: '#FFC300', sound: 'B4', message: 'Bu barkod daha önce okutuldu.'} 
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
                        <p className="text-slate-600">Sayım için kamerayı kullanmak istiyor musunuz?</p>
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
            <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-slate-800">Sayım Özeti: {currentSessionName}</h1>
                <button onClick={downloadAllCharts} disabled={!isHtmlToImageReady} className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50">
                    {ICONS.download} Tüm Grafikleri İndir
                </button>
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
    
    // Core logic for processing a scanned or entered barcode
    const processBarcode = useCallback((barcode, isBulk = false) => {
        const rawBarcode = String(barcode).trim();
        if (!rawBarcode || !selectedLibrary) return false;
        
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
            return true;
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
            return true;
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
            return true;
        }
        
        if (!isBulk) playSound('C5');
        return false;
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
        const hasWarning = processBarcode(decodedText);
        if (hasWarning) {
            setIsCameraOpen(false);
        }
        setTimeout(() => setIsProcessingScan(false), 500);
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
