# MTA Vardiya ve Yoklama

Next.js tabanli, yerel SQLite veritabani kullanan vardiya ve yoklama yonetim uygulamasi.

## Ozellikler

- Admin paneli: personel olusturma, vardiya olusturma, vardiya atama, son yoklama listesi
- Calisan paneli: giris/cikis yoklama butonlari, yaklasan vardiyalar, son kayitlar
- Rol tabanli erisim: admin ve staff
- Yerel veritabani: `data/mta-yoklama.db`

## Kurulum

1. Ornek ortam dosyasini kopyalayin:

```bash
cp .env.example .env
```

2. Paketleri kurun:

```bash
npm install
```

3. Gelistirme modunda calistirin:

```bash
npm run dev
```

Uygulama `http://<cihaz-ip>:3000` uzerinden acilir.

## Varsayilan Admin

Ilk acilista, asagidaki bilgilerle otomatik admin olusturulur:

- Kimlik No: `ADMIN_IDENTITY_NO`
- Sifre: `ADMIN_PASSWORD`

Degerleri `.env` dosyasindan degistirebilirsiniz.

## Raspberry Pi Uretim Calistirma

```bash
npm run build
npm run start
```

LAN disi erisimi kapatmak icin Raspberry Pi uzerinde firewall ile sadece yerel ag subnet'lerinizi acin.

Ornek (UFW):

```bash
sudo ufw allow from 192.168.0.0/16 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw deny 3000
sudo ufw enable
```

Bu ayar sayesinde sadece Wi-Fi/Ethernet yerel agindan panel erisilebilir olur.
