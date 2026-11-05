import { LoginForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <main className="login">
      <svg className="login-network" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="network-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd200" stopOpacity="0" />
            <stop offset=".55" stopColor="#ffd200" stopOpacity=".52" />
            <stop offset="1" stopColor="#ffd200" stopOpacity=".1" />
          </linearGradient>
          <radialGradient id="network-node">
            <stop offset="0" stopColor="#fff4a3" />
            <stop offset=".45" stopColor="#ffd200" />
            <stop offset="1" stopColor="#ffd200" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="login-network-lines">
          <path d="M560 810C850 760 1130 620 1610 250" />
          <path d="M700 900C1020 660 1220 570 1600 490" />
          <path d="M870 170L1050 105L1220 175L1405 92L1600 150" />
          <path d="M1010 315L1190 220L1370 320L1545 235" />
          <path d="M920 515L1110 430L1290 535L1510 420L1600 465" />
          <path d="M1000 720L1190 630L1400 735L1570 610" />
          <path d="M1050 105L1190 220L1010 315L1110 430L920 515" />
          <path d="M1220 175L1190 220L1370 320L1290 535L1400 735" />
          <path d="M1405 92L1370 320L1545 235L1510 420L1570 610" />
        </g>
        <g className="login-network-nodes">
          {[[870,170],[1050,105],[1220,175],[1405,92],[1010,315],[1190,220],[1370,320],[1545,235],[920,515],[1110,430],[1290,535],[1510,420],[1000,720],[1190,630],[1400,735],[1570,610]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="12" />)}
        </g>
      </svg>
      <div className="login-layout">
        <section className="login-showcase" aria-label="CPE Project Bid Excellence">
          <div className="login-showcase-lockup">
            <span className="login-cpe-mark">CPE</span>
            <span className="login-brand-divider" aria-hidden="true" />
            <span className="login-brand-copy">
              <strong>CPE</strong>
              <small>Project Bid Excellence</small>
            </span>
          </div>
          <p>ต้นทุนแม่นยำ · เสนอราคาอย่างมั่นใจ</p>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading">
            <p className="eyebrow">Secure workspace</p>
            <h1 id="login-title">เข้าสู่ระบบ</h1>
            <p>รวมงานขาย ประมาณราคา จัดซื้อ และบริหารโครงการในระบบเดียว</p>
          </div>
          <LoginForm />
          <p className="login-support">Project Bid Excellence</p>
        </section>
      </div>
    </main>
  );
}
