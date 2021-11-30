import chemistry from './languages/chemistry'
import javascript from './languages/javascript'
import {print} from './print'

let tree = print(
  'chemistry.reaction(H2O -> H2 + O ~ tempreature ** 0.5)',
  javascript
)
console.log(tree)
