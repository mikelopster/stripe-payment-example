const cors = require('cors')
const express = require('express')
const mysql = require('mysql2/promise')
const { v4: uuidv4 } = require('uuid')

require('dotenv').config()

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const app = express()
const port = 8000

// This is your Stripe CLI webhook secret for testing your endpoint locally.
const endpointSecret = 'whsec_3ca91e475714607f29b859a7d1d8a43c56274a38b5a3085cdc2b7b796bbc9acc'

// Middlewares here
// app.use(express.raw({type: 'application/json'}))
// app.use(express.json())
app.use(cors())

let conn = null

const initMySQL = async () => {
  conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'tutorial'
  })
}

app.post('/api/checkout', express.json(), async (req, res) => {
  const { product, information } = req.body
  try {
    // create payment session
    const orderId = uuidv4()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'thb',
            product_data: {
              name: product.name,
            },
            unit_amount: product.price * 100,
          },
          quantity: product.quantity,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:8888/success.html?id=${orderId}`,
      cancel_url: `http://localhost:8888/cancel.html?id=${orderId}`,
    })

    // create order in database (name, address, session id, status)
    console.log('session', session)

    const data = {
      name: information.name,
      address: information.address,
      session_id: session.id,
      status: session.status,
      order_id: orderId
    }

    const [result] = await conn.query('INSERT INTO orders SET ?', data)

    res.json({
      message: 'Checkout success.',
      id: session.id,
      result
    })
  } catch (error) {
    console.error('Error creating user:', error.message)
    res.status(400).json({ error: 'Error payment' })
  }
})

app.get('/order/:id', async (req, res) => {
  const orderId = req.params.id
  try {
    const [result] = await conn.query('SELECT * from orders where order_id = ?', orderId)
    const selectedOrder = result[0]
    if (!selectedOrder) {
      throw {
        errorMessage: 'Order not found'
      }
    }
    res.json(selectedOrder)
  } catch (error) {
    console.log('error', error)
    res.status(404).json({ error: error.errorMessage || 'System error' })
  }
})

app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const paymentSuccessData = event.data.object
      const sessionId = paymentSuccessData.id

      const data = {
        status: paymentSuccessData.status
      }

      const result = await conn.query(
        'UPDATE orders SET ? WHERE session_id = ?',
        [data, sessionId]
      )

      console.log('=== update result', result)

      // event.data.object.id = session.id
      // event.data.object.customer_details คือข้อมูลลูกค้า
      break
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send()
})

// Listen
app.listen(port, async () => {
  await initMySQL()
  console.log('Server started at port 8000')
})