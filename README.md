# EAN-13 Sayım Barkod Kontrolü

Tek dosyalık, tarayıcı içinde çalışan web uygulaması.

## Kurallar
- Ana dosyadaki gerçek boş satırlar tespit edilir, sayılır ve satır numaraları gösterilir.
- Satırlar boşluk ve görünmeyen kontrol karakterlerinden temizlenir.
- Kayıt 13 rakam olmalıdır; herhangi bir ön ek şartı aranmaz.
- EAN-13 kontrol hanesi matematiksel olarak doğrulanır.
- Geçerli EAN-13 kaydın son kontrol hanesi silinir ve ilk 12 hane esas alınır.
- Tekrarlar bu 12 haneli değer üzerinden gruplanır.
- Aynı 12 haneli değer birden fazla satırda varsa, grubun tüm örnekleri nihai listeden çıkarılır.
- Tekrar raporunda tekrar sayısı ve ana dosyadaki satır numaraları gösterilir.
- Nihai TXT dosyasında yalnızca tekil, tam 12 haneli değerler bulunur; boş satır, boşluk veya sonda fazladan satır sonu yoktur.

`index.html` dosyasını Chrome, Edge veya Firefox ile açmak yeterlidir. Dosya sunucuya yüklenmez.
