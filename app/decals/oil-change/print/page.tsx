"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"

function OilChangeDecalContent() {
  const searchParams = useSearchParams()
  const shopName = searchParams.get("shop") || "Auto Shop"
  const shopPhone = searchParams.get("phone") || ""
  const shopWebsite = searchParams.get("website") || ""
  const nextDate = searchParams.get("date") || ""
  const nextMileage = searchParams.get("mileage") || ""
  const logoUrl = searchParams.get("logo") || ""

  useEffect(() => {
    if (logoUrl) {
      // Wait for logo to load before printing
      const img = new Image()
      img.onload = () => setTimeout(() => window.print(), 300)
      img.onerror = () => setTimeout(() => window.print(), 300)
      img.src = logoUrl
    } else {
      setTimeout(() => window.print(), 400)
    }
  }, [logoUrl])

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 2in 2in;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 2in !important;
            height: 2in !important;
            overflow: hidden !important;
          }
          .no-print { display: none !important; }
        }
        @media screen {
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f0f0f0;
            margin: 0;
          }
        }
        .decal-label {
          width: 2in;
          height: 2in;
          padding: 0.1in 0.12in;
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: white;
          overflow: hidden;
        }
        .shop-logo {
          max-height: 0.35in;
          max-width: 1.2in;
          object-fit: contain;
          margin-bottom: 2pt;
        }
        .shop-name {
          font-size: 11pt;
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: 1pt;
        }
        .shop-phone {
          font-size: 9pt;
          line-height: 1.2;
          margin-bottom: 3pt;
        }
        .next-label {
          font-size: 7pt;
          text-transform: uppercase;
          letter-spacing: 1.5pt;
          color: #666;
          margin-bottom: 2pt;
        }
        .next-date {
          font-size: 11pt;
          font-weight: 700;
          line-height: 1.2;
        }
        .next-mileage {
          font-size: 11pt;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 2pt;
        }
        .divider {
          width: 60%;
          height: 1pt;
          background: #ccc;
          margin: 2pt 0;
        }
        .website {
          font-size: 7pt;
          color: #888;
        }
        /* When logo is present, reduce shop-name to prevent overflow */
        .has-logo .shop-name {
          font-size: 10pt;
        }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 12, right: 12, zIndex: 10 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Print Again
        </button>
      </div>

      <div className={`decal-label ${logoUrl ? "has-logo" : ""}`}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="shop-logo" />
        )}
        <div className="shop-name">{shopName}</div>
        <div className="shop-phone">{shopPhone}</div>
        <div className="next-label">Next Service</div>
        <div className="next-date">{nextDate}</div>
        <div className="next-mileage">{nextMileage} miles</div>
        <div className="divider" />
        <div className="website">{shopWebsite}</div>
      </div>
    </>
  )
}

export default function OilChangeDecalPrintPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading...</div>}>
      <OilChangeDecalContent />
    </Suspense>
  )
}
