async function main() {
  const res = await fetch(`http://localhost:3000/api/reports/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueId: '4f21926d-33dc-48da-8522-7a5bab2d61b9' })
  })
  const json = await res.json()
  console.log('Retry result:', json)
}

main()
