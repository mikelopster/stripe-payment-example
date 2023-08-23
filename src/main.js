const stripe = Stripe('pk_test_51NhoRBLSW3Cj7uPHChrOuRYoV24gSyFckM4xxXEqvZhAxUYa2oZDgLAAwdF84ShcYtj9Zhtrusiq2modV8sTjFQx00LbHOncyb')

const placeorder = async (data) => {
  try {

    const requestData = {
      product: {
        name: 'test',
        price: 200,
        quantity: 1
      },
      information: {
        name: data.name,
        address: data.address
      }
    }

    const response = await axios.post(
      'http://localhost:8000/api/checkout',
      requestData
    )
    const session = response.data

    stripe.redirectToCheckout({
      sessionId: session.id,
    })
  } catch (error) {
    console.log('error', error)
  }

  return null
}