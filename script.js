const form = document.getElementById('ticketForm');
const errorEl = document.getElementById('error');
const resultEl = document.getElementById('ticketResult');
const nameEl = document.getElementById('ticketName');
const referenceEl = document.getElementById('ticketReference');
const phoneEl = document.getElementById('ticketPhone');
const codeEl = document.getElementById('ticketCode');
const qrEl = document.getElementById('qrcode');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  resultEl.style.display = 'none';

  const name = document.getElementById('name').value.trim();
  const referenceBy = document.getElementById('referenceBy').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!name || !referenceBy || !phone) {
    errorEl.textContent = '⚠️ All fields are required';
    return;
  }

  try {
    const res = await fetch('https://qr-ticket-2.onrender.com/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Name: name, ReferenceBy: referenceBy, phone })
    });

    if (!res.ok) throw new Error('Server error');

    const data = await res.json();

    nameEl.textContent = "👤 Name: " + data.Name;
    referenceEl.textContent = "📝 Reference By: " + data.ReferenceBy;
    phoneEl.textContent = "📞 Phone: " + data.phone;
    codeEl.textContent = "🔑 Ticket Code: " + data.ticketCode;

    new QRious({
      element: qrEl,
      value: `https://qr-ticket-2.onrender.com/verify/${data.ticketCode}`,
      size: 200
    });

    resultEl.style.display = 'block';
    form.reset();
  } catch (err) {
    console.error(err);
    errorEl.textContent = '❌ Error generating ticket';
  }
});
