#Build BACK-END
FROM rust:buster as builder
WORKDIR /root/
RUN git clone https://github.com/paritytech/substrate-telemetry.git
RUN cd substrate-telemetry && git checkout 85b78095333cc9b767e4618e4f3457abe46e4a5e
RUN cp -rf substrate-telemetry/backend/* .
RUN cargo build --release

FROM node:10-buster-slim

#BUILD FRONT-END
WORKDIR /usr/src/app  

RUN	apt-get -y update; \
    apt-get install -y --no-install-recommends \
    ca-certificates python make g++ git supervisor dnsutils
RUN npm install -g serve
RUN git clone https://github.com/paritytech/substrate-telemetry.git
RUN cd substrate-telemetry && git checkout 85b78095333cc9b767e4618e4f3457abe46e4a5e
RUN mkdir scripts
RUN cp -rf substrate-telemetry/scripts/* ./scripts
RUN mkdir packages
RUN cp -rf substrate-telemetry/packages/* ./packages
RUN cp -f substrate-telemetry/package.json ./
RUN cp -f substrate-telemetry/yarn.lock ./
RUN cp -f substrate-telemetry/tsconfig.json ./
RUN rm -rf substrate-telemetry
RUN yarn 


#COPY BACK-END bin
WORKDIR /root/
COPY --from=builder /root/target/release/telemetry /usr/local/bin/


#Configure supervisord
COPY ./supervisord.conf /etc/supervisord/
COPY ./start-frontend.sh /usr/local/bin/
COPY ./start-backend.sh /usr/local/bin/

EXPOSE 3000 8000

ENTRYPOINT ["supervisord","-c","/etc/supervisord/supervisord.conf"]