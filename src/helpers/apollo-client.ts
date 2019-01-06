import { InMemoryCache, defaultDataIdFromObject } from 'apollo-cache-inmemory'
import { ApolloClient } from 'apollo-client'
import { ApolloLink, split } from 'apollo-link'
import { setContext } from 'apollo-link-context'
import { HttpLink } from 'apollo-link-http'
import { WebSocketLink } from 'apollo-link-ws'
import { getMainDefinition } from 'apollo-utilities'
import { OperationDefinitionNode } from 'graphql'
import { getAuthHeader } from './auth-service'
import { SERVER_URL } from './env';

const httpUri = SERVER_URL + '/graphql'
const wsUri = httpUri.replace(/^https?/, 'ws')

const httpLink = new HttpLink({
  uri: httpUri,
})

const wsLink = new WebSocketLink({
  uri: wsUri,
  options: {
    reconnect: true,
    connectionParams: () => ({
      authToken: getAuthHeader()
    }),
  },
})

const authLink = setContext((_, { headers }) => {
  const auth = getAuthHeader()

  return {
    headers: {
      ...headers,
      Authorization: auth,
    }
  }
})

const terminatingLink = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query) as OperationDefinitionNode
    return kind === 'OperationDefinition' && operation === 'subscription'
  },
  wsLink,
  authLink.concat(httpLink),
)

const link = ApolloLink.from([terminatingLink])

const cache = new InMemoryCache({
  dataIdFromObject: (object: any) => {
    switch (object.__typename) {
      case 'Message':
        return `${object.chat.id}:${object.id}`
      default:
        return defaultDataIdFromObject(object)
    }
  }
})

export default new ApolloClient({
  link,
  cache,
});
