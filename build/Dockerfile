FROM node:10-alpine

WORKDIR /app
RUN apk add --no-cache python make g++ git

RUN git clone https://github.com/paritytech/substrate-telemetry.git
RUN cd substrate-telemetry && git checkout b665555de6cdfd5a1908ded62ef0b3fca7ab1430

RUN mkdir scripts
RUN cp -rf substrate-telemetry/scripts/* ./scripts
RUN mkdir packages
RUN cp -rf substrate-telemetry/packages/* ./packages
RUN cp -f substrate-telemetry/package.json ./
RUN cp -f substrate-telemetry/yarn.lock ./
RUN cp -f substrate-telemetry/tsconfig.json ./
RUN rm -rf substrate-telemetry

RUN yarn 

ENTRYPOINT [ "yarn" ,"start:frontend"]

