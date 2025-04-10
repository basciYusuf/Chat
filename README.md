# MerYus Chat - Gerçek Zamanlı Sohbet Uygulaması

[![React](https://img.shields.io/badge/React-18.x-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-9.x-orange?logo=firebase)](https://firebase.google.com/)
[![Material UI](https://img.shields.io/badge/Material%20UI-5.x-blue?logo=mui)](https://mui.com/)
[![GitHub repo size](https://img.shields.io/github/repo-size/basciYusuf/Chat)](https://github.com/basciYusuf/Chat)

**MerYus Chat**, Firebase ve React teknolojileri kullanılarak geliştirilmiş, modern ve özellik zengini bir gerçek zamanlı sohbet uygulamasıdır. Kullanıcıların birebir veya grup halinde mesajlaşmasına, dosya paylaşmasına ve daha birçok etkileşimde bulunmasına olanak tanır.

## 🚀 Temel Özellikler

*   **Gerçek Zamanlı Mesajlaşma:** Firebase Firestore sayesinde anlık mesaj gönderimi ve alımı.
*   **Kullanıcı Kimlik Doğrulama:** Firebase Authentication ile güvenli e-posta/şifre kaydı ve girişi.
*   **Birebir Sohbet:** Kullanıcılar arasında özel sohbet odaları.
*   **Grup Sohbetleri:** Kullanıcıların grup oluşturabilmesi, üye ekleyip çıkarabilmesi ve grup içinde mesajlaşabilmesi.
    *   Grup yöneticisi yetkileri.
    *   Grup adı ve açıklaması düzenleme.
*   **Mesaj Yönetimi:**
    *   Mesaj düzenleme ve silme (gönderen tarafından).
    *   Mesajlara emoji ile tepki verme.
    *   Mesajları yanıtlama (alıntılama).
    *   Mesajları yıldızlama ve sabitleme (pinleme).
    *   Okundu/Okunmadı bilgisi (`readBy` alanı ile).
*   **Son Görülme & Çevrimiçi Durumu:** Kullanıcıların çevrimiçi durumunu ve son görülme zamanını gösterme.
*   **Dosya Paylaşımı:** Firebase Storage kullanarak resim ve diğer dosyaları gönderme.
*   **Bildirimler:** Tarayıcı bildirimleri ile yeni mesajlardan haberdar olma.
*   **Kullanıcı Profili:** Kullanıcıların görünen adını ve profil fotoğrafını güncellemesi.
*   **Ayarlar:**
    *   Karanlık/Aydınlık tema seçimi (Material UI & Context API).
    *   Bildirim tercihleri.
*   **Arama:** Sohbetler, gruplar ve kullanıcılar arasında arama yapma.
*   **Duyarlı Tasarım (Responsive):** Farklı ekran boyutlarına uyumlu arayüz (Material UI Grid/Box).
*   **Şifre Sıfırlama:** Kayıtlı e-posta adresine sıfırlama bağlantısı gönderme.

## 🛠️ Kullanılan Teknolojiler

*   **Frontend:**
    *   [React](https://reactjs.org/) (v18+)
    *   [TypeScript](https://www.typescriptlang.org/)
    *   [Material UI (MUI)](https://mui.com/) - Component Kütüphanesi
    *   [React Router DOM](https://reactrouter.com/) - Sayfa Yönlendirme
    *   Context API - Global State Yönetimi (Tema, Auth)
*   **Backend & Veritabanı:**
    *   [Firebase](https://firebase.google.com/)
        *   **Firestore:** Gerçek zamanlı NoSQL veritabanı (mesajlar, kullanıcılar, gruplar).
        *   **Authentication:** Kullanıcı kimlik doğrulama.
        *   **Storage:** Dosya depolama (profil fotoğrafları, ekler).
*   **Diğer:**
    *   [Git](https://git-scm.com/) & [GitHub](https://github.com/) - Versiyon Kontrolü

## ⚙️ Kurulum ve Çalıştırma

1.  **Repoyu Klonlama:**
    ```bash
    git clone https://github.com/basciYusuf/Chat.git
    cd Chat
    ```

2.  **Bağımlılıkları Yükleme:**
    ```bash
    npm install
    # veya
    # yarn install
    ```

3.  **Firebase Kurulumu:**
    *   [Firebase Console](https://console.firebase.google.com/) adresine gidin ve yeni bir proje oluşturun (veya mevcut projeyi kullanın).
    *   Projenize bir **Web Uygulaması** ekleyin.
    *   Uygulama ayarlarından Firebase yapılandırma bilgilerinizi (apiKey, authDomain, projectId vb.) alın.
    *   Proje içindeki `src/config/firebase.ts` dosyasını kendi Firebase yapılandırma bilgilerinizle güncelleyin.
    *   **Firestore Veritabanı:** Oluşturun ve test modunda veya uygun güvenlik kurallarıyla başlatın.
    *   **Authentication:** "Sign-in method" sekmesinden "Email/Password" sağlayıcısını etkinleştirin.
    *   **Storage:** Bir depolama (bucket) oluşturun.

4.  **Uygulamayı Başlatma:**
    ```bash
    npm start
    # veya
    # yarn start
    ```
    Uygulama varsayılan olarak `http://localhost:3000` adresinde açılacaktır.

## 🎨 Ekran Görüntüleri

*(Buraya uygulamanızın birkaç ekran görüntüsünü ekleyebilirsiniz. Örneğin: Giriş sayfası, Sohbet listesi, Sohbet ekranı, Grup sohbeti, Ayarlar vb.)*

```
[Ekran Görüntüsü 1 Açıklaması]
<img src="/path/to/screenshot1.png" width="400" />

[Ekran Görüntüsü 2 Açıklaması]
<img src="/path/to/screenshot2.png" width="400" />
```

## 📄 Güvenlik Kuralları (Firestore)

Uygulamanın güvenliği için Firestore güvenlik kurallarını ayarlamak önemlidir. İşte başlangıç için temel kurallar:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Kullanıcılar: Sadece giriş yapmış kullanıcılar kendi bilgilerini okuyabilir/güncelleyebilir.
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Kullanıcı Adları: Benzersizliği kontrol etmek için kullanılır.
    match /usernames/{username} {
       allow read: if request.auth != null;
       allow create: if request.auth != null; // Sadece yeni kayıt olanlar oluşturabilir (daha detaylı kural gerekebilir)
    }

    // Sohbetler: Sadece katılımcılar okuyabilir/yazabilir.
    match /chats/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid in resource.data.participants;

      // Mesajlar: Sadece katılımcılar okuyabilir, sadece gönderen yazabilir (veya silebilir/düzenleyebilir - daha detaylı kurallar gerekir).
      match /messages/{messageId} {
        allow read: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if request.auth != null && request.auth.uid == request.resource.data.senderId;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.senderId; // Sadece gönderen güncelleyebilir/silebilir
      }
    }

    // Gruplar: Sadece üyeler okuyabilir/yazabilir (Rol bazlı kurallar daha detaylı olabilir).
    match /groups/{groupId} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)); // Üye kontrolü
      allow create: if request.auth != null; // Grup oluşturma
      allow update: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)); // Üyeler güncelleyebilir (detaylandırılmalı)

      // Grup Üyeleri (Alt Koleksiyon)
      match /members/{userId} {
          allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
          // Yazma işlemleri (ekleme/çıkarma/rol) daha kısıtlı olmalı (örn: sadece adminler)
          allow write: if request.auth != null; // Şimdilik basit tutuldu
      }

      // Grup Mesajları
      match /messages/{messageId} {
        allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
        allow create: if request.auth != null && request.auth.uid == request.resource.data.senderId;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.senderId; // Sadece gönderen
      }
    }
  }
}
```

**Not:** Bu kurallar temel bir başlangıç noktasıdır. Uygulamanızın özel gereksinimlerine göre daha detaylı ve güvenli hale getirilmelidir (örneğin, grup üyesi ekleme/çıkarma yetkileri, mesaj düzenleme/silme koşulları vb.).

## 🤝 Katkıda Bulunma

Katkılarınız memnuniyetle karşılanır! Lütfen bir issue açın veya bir pull request gönderin.

## 📜 Lisans

Bu proje [MIT Lisansı](LICENSE) altındadır. (Eğer bir LICENSE dosyanız yoksa bu satırı kaldırabilir veya bir tane ekleyebilirsiniz.)

---

*Geliştiren: Yusuf Başçı* - [GitHub](https://github.com/basciYusuf)
