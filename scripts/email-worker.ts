import { processEmailQueue } from "../lib/email";
processEmailQueue(50).then((result)=>{console.log(result);process.exit(result.failed?1:0)}).catch((error)=>{console.error(error);process.exit(1)});
