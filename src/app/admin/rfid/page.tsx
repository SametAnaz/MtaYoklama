import { requireRole } from "@/lib/auth";
import { getCards, checkRfidHealth } from "./_actions/rfid-actions";
import { RegisterCardForm } from "./_components/register-card-form";
import { DeleteCardButton } from "./_components/delete-card-button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RFID Kart Yönetimi — MTA Admin",
  description: "RFID kart kayıt ve yönetim paneli",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RfidPage() {
  await requireRole("admin");
  const [cards, isOnline] = await Promise.all([getCards(), checkRfidHealth()]);

  return (
    <main className="shell stack-lg">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <header className="page-header">
        <div className="page-header-info">
          <p className="eyebrow">Admin Paneli</p>
          <h1>RFID Kart Yönetimi</h1>
          <p className="muted">RC522 okuyucu ile kart kayıt ve yönetimi</p>
        </div>
        <div className="cluster">
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 0.875rem",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              color: "var(--ink)",
            }}
          >
            Admin Paneline Dön
          </Link>
        </div>
      </header>

      {/* ── Service status ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          padding: "var(--sp-3) var(--sp-4)",
          background: isOnline ? "var(--accent-light)" : "var(--error-light, #fff0f0)",
          border: `1.5px solid ${isOnline ? "var(--accent)" : "var(--error)"}`,
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-sm)",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: isOnline ? "var(--accent)" : "var(--error)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>
          {isOnline ? "RFID servis çevrimiçi" : "RFID servis çevrimdışı"}
        </span>
        {!isOnline && (
          <span style={{ color: "var(--error)", marginLeft: "var(--sp-2)" }}>
            — Python API'ye ulaşılamıyor. Systemd servisini kontrol edin:{" "}
            <code style={{ fontFamily: "monospace" }}>sudo systemctl status rfid-api</code>
          </span>
        )}
        {isOnline && (
          <span style={{ color: "var(--ink-muted)" }}>
            · {process.env.RFID_API_URL ?? "http://localhost:8001"}
          </span>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="grid-two" style={{ alignItems: "start" }}>

        {/* Kart kayıt formu */}
        <section aria-labelledby="register-heading">
          <div className="section-title">
            <h2 id="register-heading">Yeni Kart Kaydet</h2>
            <span className="badge badge-neutral">
              {isOnline ? "Hazır" : "Servis kapalı"}
            </span>
          </div>
          <div className="card">
            {isOnline ? (
              <div className="stack">
                <div
                  style={{
                    background: "var(--surface-2, var(--surface))",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--sp-3)",
                    fontSize: "var(--text-sm)",
                    color: "var(--ink-muted)",
                  }}
                >
                  Formu doldurup <strong>Kart Kaydet</strong> butonuna basın,
                  ardından fiziksel kartı RFID okuyucuya yaklaştırın.
                </div>
                <RegisterCardForm />
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">—</span>
                <p>RFID servisi çalışmıyor. Kart kaydı yapılamaz.</p>
              </div>
            )}
          </div>
        </section>

        {/* Kayıtlı kartlar */}
        <section aria-labelledby="cards-heading">
          <div className="section-title">
            <h2 id="cards-heading">Kayıtlı Kartlar</h2>
            <span className="badge badge-neutral">{cards.length} kart</span>
          </div>
          <div className="card">
            {cards.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">—</span>
                <p>Henüz kayıtlı kart yok.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>TC Kimlik No</th>
                      <th>Kart UID</th>
                      <th>Kayıt Tarihi</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => (
                      <tr key={card.uid}>
                        <td style={{ fontWeight: 500 }}>
                          {card.first_name} {card.last_name}
                        </td>
                        <td className="font-mono text-sm">{card.tc_no}</td>
                        <td className="font-mono text-sm">{card.uid}</td>
                        <td className="text-sm subtle">{fmtDate(card.created_at)}</td>
                        <td>
                          <DeleteCardButton
                            uid={card.uid}
                            name={`${card.first_name} ${card.last_name}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
