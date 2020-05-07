import React, {
  useEffect,
  FunctionComponent,
  useContext,
  useReducer,
} from 'react'
import getPrices from '../utils/getPrices'
import _ from 'lodash'
import CommerceLayerContext from '../context/CommerceLayerContext'
import priceReducer, {
  SetSkuCodesPrice,
  unsetPriceState,
} from '../reducers/PriceReducer'
import { priceInitialState, getSkusPrice } from '../reducers/PriceReducer'
import PricesContext, { PricesContextValue } from '../context/PricesContext'
import getCurrentItemKey from '../utils/getCurrentItemKey'
import ItemContext from '../context/ItemContext'
import { PropsType } from '../utils/PropsType'
import components from '../config/components'

const propTypes = components.PricesContainer.propTypes
const defaultProps = components.PricesContainer.defaultProps
const displayName = components.PricesContainer.displayName

export type PCProps = PropsType<typeof propTypes>

const PricesContainer: FunctionComponent<PCProps> = (props) => {
  const { children, skuCode, loader, perPage, filters } = props
  const [state, dispatch] = useReducer(priceReducer, priceInitialState)
  const config = useContext(CommerceLayerContext)
  const {
    setPrices,
    prices,
    items,
    item: currentItem,
    skuCode: itemSkuCode,
  } = useContext(ItemContext)
  if (_.indexOf(state.skuCodes, skuCode) === -1 && skuCode)
    state.skuCodes.push(skuCode)
  const sCode = getCurrentItemKey(currentItem) || skuCode || itemSkuCode || ''
  const setSkuCodes: SetSkuCodesPrice = (skuCodes) => {
    dispatch({
      type: 'setSkuCodes',
      payload: { skuCodes },
    })
  }
  useEffect(() => {
    if (currentItem && _.has(prices, sCode)) {
      dispatch({
        type: 'setPrices',
        payload: { prices: prices },
      })
    }
    if (!_.isEmpty(items) && _.isEmpty(currentItem)) {
      const p = getPrices(items)
      dispatch({
        type: 'setPrices',
        payload: { prices: p },
      })
    }
    if (
      (config.accessToken && _.isEmpty(currentItem)) ||
      (config.accessToken && !_.has(prices, sCode))
    ) {
      if (state.skuCodes.length > 0 || skuCode) {
        getSkusPrice((sCode && [sCode]) || state.skuCodes, {
          config,
          dispatch,
          setPrices,
          prices,
          perPage: perPage || 0,
          filters: filters || {},
        })
      }
    }
    return (): void => {
      if (_.isEmpty(currentItem)) {
        unsetPriceState(dispatch)
      }
    }
  }, [config.accessToken, currentItem])
  const priceValue: PricesContextValue = {
    ...state,
    skuCode: sCode,
    loader: loader || 'Loading...',
    setSkuCodes,
  }
  return (
    <PricesContext.Provider value={priceValue}>
      {children}
    </PricesContext.Provider>
  )
}

PricesContainer.propTypes = propTypes
PricesContainer.defaultProps = defaultProps
PricesContainer.displayName = displayName

export default PricesContainer
