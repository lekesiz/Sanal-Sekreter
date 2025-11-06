# 🚀 Quick Start Guide - NETZ Sanal Sekreter

Bu rehber, sanal sekreter sistemini yerel ortamda hızlıca çalıştırmanız için gerekli adımları içerir.

## 📋 Ön Gereksinimler

- Node.js v18 veya üzeri
- Docker ve Docker Compose
- Google Cloud hesabı (Speech, Text-to-Speech için)
- Twilio hesabı (veya Dialogflow CX)
- OpenAI API anahtarı

## 🔧 Kurulum Adımları

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. Environment Variables Ayarlayın

```bash
# .env.example dosyasını kopyalayın
cp .env.example .env

# .env dosyasını düzenleyin ve gerekli API anahtarlarını ekleyin
```

**Minimum gerekli değişkenler:**
- `OPENAI_API_KEY`: OpenAI API anahtarınız
- `GCP_PROJECT_ID`: Google Cloud proje ID'niz
- `GOOGLE_APPLICATION_CREDENTIALS`: Service account JSON dosya yolu
- `TWILIO_ACCOUNT_SID` ve `TWILIO_AUTH_TOKEN`: Twilio credentials

### 3. Google Cloud Service Account

1. Google Cloud Console'da bir service account oluşturun
2. Aşağıdaki API'leri aktifleştirin:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
   - Google Drive API
   - Gmail API
   - Calendar API
   - People API (Contacts)

3. Service account JSON anahtarını indirin ve proje dizinine `service-account.json` olarak kaydedin

### 4. Veritabanını Başlatın

```bash
# PostgreSQL + Redis başlat
docker-compose up -d postgres redis

# Veya setup scriptini kullanın
npm run setup:db
```

### 5. Örnek Verileri Yükleyin

```bash
# Bilgi bankası dokümanlarını ekle
npm run seed
```

### 6. Uygulamayı Başlatın

```bash
# Geliştirme modu
npm run dev

# Veya production mode
npm start
```

Uygulama http://localhost:3000 adresinde çalışacaktır.

## 🧪 Test

### Health Check

```bash
curl http://localhost:3000/health
```

Beklenen yanıt:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-06T...",
  "environment": "development",
  "version": "1.0.0"
}
```

### RAG Sistemi Test

```bash
# Dokümanları indeksle (OpenAI API key gerekli)
npm run index-documents

# RAG query test
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are your business hours?"}'
```

## 📞 Twilio Entegrasyonu

### 1. Twilio Webhook URL'lerini Ayarlayın

Twilio Console > Phone Numbers > Active Numbers > Your Number:

- **Voice URL (Webhook)**: `https://your-domain.com/api/webhooks/twilio/voice`
- **Status Callback URL**: `https://your-domain.com/api/webhooks/twilio/status`

### 2. ngrok ile Yerel Test

```bash
# ngrok yükleyin
npm install -g ngrok

# Tunnel oluşturun
ngrok http 3000

# Çıktıdaki HTTPS URL'yi Twilio webhook olarak kullanın
# Örnek: https://abc123.ngrok.io/api/webhooks/twilio/voice
```

## 🔐 Google Workspace OAuth

### 1. OAuth Consent Screen

Google Cloud Console > APIs & Services > OAuth consent screen:
- User Type: External
- Scopes: gmail.readonly, drive.readonly, calendar.readonly, contacts.readonly

### 2. OAuth Credentials

OAuth 2.0 Client ID oluşturun:
- Application type: Web application
- Authorized redirect URIs: `http://localhost:3000/oauth2callback`

### 3. Refresh Token Alın

```bash
# OAuth flow başlat
npm run oauth:authorize

# Tarayıcıda açılan linke gidin, authorize edin
# Dönen refresh token'ı .env dosyasına ekleyin
```

## 📊 Veritabanı Yönetimi

### pgAdmin Kullanımı

```bash
# pgAdmin başlat (dev profile)
docker-compose --profile dev up pgadmin

# http://localhost:5050 adresine gidin
# Email: admin@netz.fr
# Password: admin
```

### Direct PostgreSQL Bağlantısı

```bash
psql -h localhost -p 5432 -U postgres -d sanal_sekreter
```

## 🎯 Kullanım Senaryoları

### Senaryo 1: Basit Sorgu (RAG)

1. Sistem knowledge base'den bilgi arar
2. LLM cevap oluşturur
3. TTS ile seslendirilir

### Senaryo 2: Randevu Talebi

1. Intent: `appointment`
2. Calendar API ile müsait saatler bulunur
3. Kullanıcıya alternatifler sunulur
4. Onaylandığında event oluşturulur

### Senaryo 3: Canlı Temsilciye Aktarma

1. Intent: `agent_request` veya karmaşık sorun
2. Handoff kararı verilir
3. Call summary hazırlanır
4. Temsilciye bağlanır

## 🐛 Sorun Giderme

### Database Connection Error

```bash
# Container'ların çalıştığından emin olun
docker-compose ps

# Logları kontrol edin
docker-compose logs postgres
```

### OpenAI API Hatası

```bash
# API key doğru mu?
echo $OPENAI_API_KEY

# Quota kontrolü
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Twilio Webhook Hatası

```bash
# ngrok çalışıyor mu?
curl http://localhost:4040/api/tunnels

# Webhook URL doğru mu?
# Twilio Console > Phone Numbers > Webhooks
```

## 📚 Daha Fazla Bilgi

- [API Dokümantasyonu](docs/API.md)
- [Deployment Rehberi](docs/DEPLOYMENT.md)
- [Güvenlik En İyi Pratikler](docs/SECURITY.md)

## 🆘 Destek

Sorun yaşıyorsanız:
1. GitHub Issues: https://github.com/netz-informatique/sanal-sekreter/issues
2. Email: contact@netz-informatique.fr

---

**Not**: Bu bir development ortamı kurulumudur. Production deployment için [DEPLOYMENT.md](docs/DEPLOYMENT.md) dökümanına bakın.
