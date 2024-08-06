import {
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import Parent from '../utils/Parent'
import { type ChildrenFunction } from '#typings/index'
import PlaceOrderContext from '#context/PlaceOrderContext'
import isFunction from 'lodash/isFunction'
import PaymentMethodContext from '#context/PaymentMethodContext'
import OrderContext from '#context/OrderContext'
import getCardDetails from '#utils/getCardDetails'
import type { BaseError } from '#typings/errors'
import type { Order } from '@commercelayer/sdk'

interface ChildrenProps extends Omit<Props, 'children'> {
  /**
   * Callback function to place the order
   */
  handleClick: () => Promise<void>
}

interface Props
  extends Omit<JSX.IntrinsicElements['button'], 'children' | 'onClick'> {
  children?: ChildrenFunction<ChildrenProps>
  /**
   * The label of the button
   */
  label?: string | ReactNode
  /**
   * The label of the button when it's loading
   */
  loadingLabel?: string | ReactNode
  /**
   * If false, the button doesn't place the order automatically. Default: true
   */
  autoPlaceOrder?: boolean
  /**
   * Callback function that is fired when the button is clicked
   */
  onClick?: (response: {
    placed: boolean
    order?: Order
    errors?: BaseError[]
  }) => void
}

export function PlaceOrderButton(props: Props): JSX.Element {
  const ref = useRef(null)
  const {
    children,
    label = 'Place order',
    loadingLabel = 'Placing...',
    autoPlaceOrder = true,
    disabled,
    onClick,
    ...p
  } = props
  const {
    isPermitted,
    setPlaceOrder,
    options,
    paymentType,
    setButtonRef,
    setPlaceOrderStatus
  } = useContext(PlaceOrderContext)
  const [notPermitted, setNotPermitted] = useState(true)
  const [forceDisable, setForceDisable] = useState(disabled)
  const [isLoading, setIsLoading] = useState(false)
  const {
    currentPaymentMethodRef,
    loading,
    currentPaymentMethodType,
    paymentSource,
    setPaymentSource,
    setPaymentMethodErrors,
    currentCustomerPaymentSourceId
  } = useContext(PaymentMethodContext)
  const { order } = useContext(OrderContext)
  const isFree = order?.total_amount_with_taxes_cents === 0
  useEffect(() => {
    if (loading) setNotPermitted(loading)
    else {
      if (paymentType === currentPaymentMethodType && paymentType) {
        const card = getCardDetails({
          customerPayment: {
            payment_source: paymentSource
          },
          paymentType
        })
        if (
          currentCustomerPaymentSourceId != null &&
          paymentSource?.id === currentCustomerPaymentSourceId &&
          card.brand === ''
        ) {
          // Force creadit card icon for customer payment source imported by API
          card.brand = 'credit-card'
        }
        if (
          ((isFree && isPermitted) ||
            currentPaymentMethodRef?.current?.onsubmit ||
            card.brand) &&
          isPermitted
        ) {
          setNotPermitted(false)
        }
      } else if (isFree && isPermitted) {
        setNotPermitted(false)
      } else {
        setNotPermitted(true)
      }
    }
    return () => {
      setNotPermitted(true)
    }
  }, [
    isPermitted,
    paymentType,
    currentPaymentMethodRef?.current?.onsubmit,
    loading,
    currentPaymentMethodType,
    order,
    paymentSource
  ])
  useEffect(() => {
    if (
      paymentType === 'paypal_payments' &&
      options?.paypalPayerId &&
      order?.status &&
      ['draft', 'pending'].includes(order?.status) &&
      autoPlaceOrder
    ) {
      void handleClick()
    }
  }, [options?.paypalPayerId, paymentType])
  useEffect(() => {
    if (
      paymentType === 'stripe_payments' &&
      ['succeeded', 'pending'].includes(
        options?.stripe?.redirectStatus ?? ''
      ) &&
      order?.status &&
      ['draft', 'pending'].includes(order?.status) &&
      autoPlaceOrder
    ) {
      void handleClick()
    }
  }, [options?.stripe?.redirectStatus, paymentType])
  useEffect(() => {
    if (order?.status != null && ['draft', 'pending'].includes(order?.status)) {
      // @ts-expect-error no type
      const resultCode = order?.payment_source?.payment_response?.resultCode === 'Authorised'
      // @ts-expect-error no type
      const paymentDetails = order?.payment_source?.payment_request_details?.details != null
      if (
        paymentType === 'adyen_payments' &&
        options?.adyen?.redirectResult &&
        !paymentDetails
      ) {
        const attributes = {
          payment_request_details: {
            details: {
              redirectResult: options?.adyen?.redirectResult
            }
          },
          _details: 1
        }
        void setPaymentSource({
          paymentSourceId: paymentSource?.id,
          paymentResource: 'adyen_payments',
          attributes
        }).then((res) => {
          // @ts-expect-error no type
          const resultCode: string = res?.payment_response?.resultCode
          // @ts-expect-error no type
          const errorCode = res?.payment_response?.errorCode
          // @ts-expect-error no type
          const message = res?.payment_response?.message
          if (
            ['Authorised', 'Pending', 'Received'].includes(resultCode) &&
            autoPlaceOrder
          ) {
            void handleClick()
          } else if (errorCode != null) {
            setPaymentMethodErrors([
              {
                code: 'PAYMENT_INTENT_AUTHENTICATION_FAILURE',
                resource: 'payment_methods',
                field: currentPaymentMethodType,
                message
              }
            ])
          }
        })
      } else if (
        paymentType === 'adyen_payments' &&
        options?.adyen?.MD &&
        options?.adyen?.PaRes &&
        autoPlaceOrder
      ) {
        void handleClick()
      } else if (
        paymentType === 'adyen_payments' &&
        resultCode &&
        // @ts-expect-error no type
        ref?.current?.disabled === false &&
        currentCustomerPaymentSourceId == null &&
        autoPlaceOrder
      ) {
        // NOTE: This is a workaround for the case when the user reloads the page after selecting a customer payment source
        if (
          // @ts-expect-error no type
          order?.payment_source?.payment_response?.merchantReference?.includes(
            order?.number
          )
        ) {
          void handleClick()
        }
      }
    }
  }, [
    options?.adyen,
    paymentType,
    // @ts-expect-error no type
    order?.payment_source?.payment_response?.resultCode
  ])
  useEffect(() => {
    if (
      paymentType === 'checkout_com_payments' &&
      options?.checkoutCom?.session_id &&
      order?.status &&
      ['draft', 'pending'].includes(order?.status) &&
      autoPlaceOrder
    ) {
      void handleClick()
    }
  }, [options?.checkoutCom, paymentType])
  useEffect(() => {
    if (ref?.current != null && setButtonRef != null) {
      setButtonRef(ref)
    }
  }, [ref])
  const handleClick = async (
    e?: MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e?.preventDefault()
    e?.stopPropagation()
    setIsLoading(true)
    let isValid = true
    setForceDisable(true)
    const checkPaymentSource = await setPaymentSource({
      // @ts-expect-error no type not be undefined
      paymentResource: paymentType,
      paymentSourceId: paymentSource?.id
    })
    const card =
      paymentType &&
      getCardDetails({
        paymentType,
        customerPayment: { payment_source: checkPaymentSource }
      })
    if (
      currentPaymentMethodRef?.current?.onsubmit &&
      [
        !options?.paypalPayerId,
        !options?.adyen?.MD,
        !options?.checkoutCom?.session_id
      ].every(Boolean)
    ) {
      isValid = (await currentPaymentMethodRef.current?.onsubmit({
        // @ts-expect-error no type
        paymentSource: checkPaymentSource,
        setPlaceOrder,
        onclickCallback: onClick
      })) as boolean
      if (
        !isValid &&
        // @ts-expect-error no type
        checkPaymentSource.payment_response?.resultCode === 'Authorised'
      ) {
        isValid = true
      }
    } else if (card?.brand) {
      isValid = true
    }
    if (isValid && setPlaceOrderStatus != null) {
      setPlaceOrderStatus({ status: 'placing' })
    }
    const placed =
      isValid &&
      setPlaceOrder &&
      (checkPaymentSource || isFree) &&
      (await setPlaceOrder({
        paymentSource: checkPaymentSource,
        currentCustomerPaymentSourceId
      }))
    setForceDisable(false)
    onClick && placed && onClick(placed)
    setIsLoading(false)
    if (setPlaceOrderStatus != null) {
      setPlaceOrderStatus({ status: 'standby' })
    }
  }
  const disabledButton = disabled !== undefined ? disabled : notPermitted
  const labelButton = isLoading
    ? loadingLabel
    : isFunction(label)
      ? label()
      : label
  const parentProps = {
    ...p,
    label,
    disabled: disabledButton,
    handleClick,
    parentRef: ref,
    isLoading
  }
  return children ? (
    <Parent {...parentProps}>{children}</Parent>
  ) : (
    <button
      ref={ref}
      type='button'
      disabled={disabledButton || forceDisable}
      onClick={(e) => {
        void handleClick(e)
      }}
      {...p}
    >
      {labelButton}
    </button>
  )
}

export default PlaceOrderButton
