import { Logger, LoggerService } from "@nestjs/common";

import { BrokerAdapterInterface } from "./broker-adapter.interface";
import { MODULE_NAME } from "./../constants";

export class RabbitMQAdapter implements BrokerAdapterInterface {
  private logger: Logger;
  constructor(private url: string, private service: string, private customLogger?: Logger) {
    this.logger = new Logger(MODULE_NAME);
    if (customLogger) {
      this.logger = customLogger;
    }
  }

  public async publish(topic: string, content: {}): Promise<void> {
    try {
      const connect = this.connect(this.url);
      connect
        .then(async (connection: any) => {
          return connection.createChannel();
        })
        .then(async (channel: any) => {
          this.logger.log(`Publish ${topic} ${JSON.stringify(content)}`);

          return Promise.all([
            channel.assertExchange(topic, "fanout"),
            channel.publish(topic, "", Buffer.from(JSON.stringify(content)))
          ]);
        });
    } catch (e) {
      this.logger.error(e);
    }
  }

  public async subscribe(topic: string, callback: (message: string) => void): Promise<void> {
    try {
      const connect = this.connect(this.url);
      connect
        .then(async (connection: any) => {
          return connection.createChannel();
        })
        .then(async (channel: any) => {
          const exchange = topic;
          topic = `${this.service}_${topic}`;

          return Promise.all([
            channel.assertQueue(topic),
            channel.assertExchange(exchange, "fanout"),
            channel.bindQueue(topic, exchange),
            channel.consume(topic, async msg => {
              this.logger.log(`Consume ${topic} ${msg.content.toString()}`);
              if (msg !== null) {
                try {
                  callback(JSON.parse(msg.content.toString()));
                  channel.ack(msg);
                } catch (e) {
                  // TODO handle nack
                  channel.reject();
                }
              }
            })
          ]);
        });
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async connect(url: string): Promise<any> {
    return require("amqplib").connect(url);
  }
}
