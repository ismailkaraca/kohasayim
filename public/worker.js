// public/worker.js

// Gerekli kütüphaneyi worker'ın içine aktarıyoruz.
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

// Worker'ın hafızasında tutulacak olan global değişkenler
let kohaDataMap = new Map();
let combinedLibraries = new Map();
let processedBarcodes = new Set();

// Uyarı tanımlamaları (Ana component'teki ile aynı)
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

// ISBN kontrol fonksiyonu
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


// Ana component'ten gelen mesajları dinleyen ana fonksiyon
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'LOAD_EXCEL':
            handleExcelLoad(payload.file);
            break;
        case 'PROCESS_BARCODE':
            processSingleBarcode(payload);
            break;
        case 'PROCESS_BULK':
             processBulkBarcodes(payload);
            break;
        case 'SET_CONTEXT':
            // Kütüphane, lokasyon gibi anlık verileri ana thread'den al
            combinedLibraries = new Map(payload.libraryOptions);
            processedBarcodes = new Set(payload.processedBarcodes);
            break;
        case 'RESET_STATE':
            // Yeni bir oturum başladığında worker'ın durumunu sıfırla
            kohaDataMap.clear();
            processedBarcodes.clear();
            self.postMessage({ type: 'STATE_RESET' });
            break;
    }
};

// Excel dosyasını işleyen fonksiyon
function handleExcelLoad(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = self.XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = self.XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0 || !json[0].hasOwnProperty('barkod')) {
                throw new Error("Yüklenen dosyada 'barkod' sütunu bulunamadı.");
            }

            // Veriyi hızlı arama için bir Map objesine dönüştür
            kohaDataMap = new Map(json.map(item => [String(item.barkod), item]));
            
            // Ana thread'e verinin hazır olduğunu ve ham veriyi bildir
            self.postMessage({ type: 'DATA_READY', payload: { count: kohaDataMap.size, kohaData: json } });

        } catch (err) {
            self.postMessage({ type: 'ERROR', payload: `Dosya okunurken bir hata oluştu: ${err.message}` });
        }
    };
    reader.onerror = () => {
        self.postMessage({ type: 'ERROR', payload: "Dosya okuma başarısız oldu." });
    };
    reader.readAsArrayBuffer(file);
}

// Tek bir barkodu işleyen fonksiyon
function processSingleBarcode(payload) {
    const result = processBarcodeLogic(payload);
    if(result) {
      processedBarcodes.add(result.barcode); // İşlenen barkodu sete ekle
      self.postMessage({ type: 'BARCODE_PROCESSED', payload: result });
    }
}

// Toplu barkod listesini işleyen fonksiyon
function processBulkBarcodes(payload) {
    const results = [];
    const { barcodes } = payload;
    barcodes.forEach((barcode, index) => {
        const result = processBarcodeLogic({ ...payload, barcode });
        if(result) {
            processedBarcodes.add(result.barcode);
            results.push(result);
        }
        // İlerleme durumunu ana thread'e gönder
        if ((index + 1) % 100 === 0 || index + 1 === barcodes.length) {
            self.postMessage({ type: 'BULK_PROGRESS', payload: { current: index + 1, total: barcodes.length } });
        }
    });
    self.postMessage({ type: 'BULK_PROCESSED', payload: results });
}


// Tüm barkod işleme mantığını içeren merkezi fonksiyon
function processBarcodeLogic({ barcode, selectedLibrary, selectedLocation }) {
    const rawBarcode = String(barcode).trim();
    if (!rawBarcode || !selectedLibrary) return null;

    if (isIsbn(rawBarcode)) {
        return { barcode: rawBarcode, isValid: false, warnings: [WARNING_DEFINITIONS.isbnDetected], data: null, timestamp: new Date().toISOString() };
    }

    let originalBarcode = rawBarcode.replace(/[^0-9]/g, '');
    let normalizedBarcode = originalBarcode;
    let wasAutoCompleted = false;

    const expectedPrefix = String(parseInt(selectedLibrary, 10) + 1000);

    if (normalizedBarcode.length >= 13) {
        normalizedBarcode = normalizedBarcode.slice(0, 12);
    }

    if (normalizedBarcode.length < 12 && normalizedBarcode.length > 0) {
        wasAutoCompleted = true;
        normalizedBarcode = expectedPrefix + originalBarcode.padStart(12 - expectedPrefix.length, '0');
    }

    if (processedBarcodes.has(normalizedBarcode)) {
        const existingItemData = kohaDataMap.get(normalizedBarcode);
        return { barcode: normalizedBarcode, isValid: false, warnings: [WARNING_DEFINITIONS.duplicate], data: existingItemData, timestamp: new Date().toISOString() };
    }

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
        return { barcode: originalBarcode, isValid: false, warnings: [finalWarning], data: kohaDataMap.get(normalizedBarcode) || null, timestamp: new Date().toISOString() };
    }

    const itemData = kohaDataMap.get(normalizedBarcode);
    const warnings = [];
    if (itemData) {
        if (selectedLocation && String(itemData['materyalin_yeri_kodu'] || '') !== selectedLocation) warnings.push(WARNING_DEFINITIONS.locationMismatch);
        const loanEligibilityCode = String(itemData['odunc_verilebilirlik_kodu']);
        if (!['0', '2'].includes(loanEligibilityCode)) warnings.push({ ...WARNING_DEFINITIONS.notLoanable, message: `Ödünç Verilemez` });
        if (String(itemData['materyal_statusu_kodu']) !== '0') warnings.push(WARNING_DEFINITIONS.notInCollection);
        if (String(itemData['odunc_durumu']) === '1') warnings.push(WARNING_DEFINITIONS.onLoan);
    } else {
        warnings.push(wasAutoCompleted ? WARNING_DEFINITIONS.autoCompletedNotFound : WARNING_DEFINITIONS.deleted);
    }

    return {
        barcode: normalizedBarcode,
        isValid: warnings.length === 0,
        warnings,
        data: itemData,
        timestamp: new Date().toISOString()
    };
}
