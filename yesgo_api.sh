#!/bin/sh
#
# Note runlevel 2345, 86 is the Start order and 85 is the Stop order
#
# chkconfig: 2345 86 85
# description: Description of the Service
# sudo cp one-corporativo.sh /etc/init.d/one-corporativo
# chmod a+x /etc/init.d/one-corporativo
# chkconfig --add one-corporativo
#
# Below is the source function library, leave it be
. /etc/init.d/functions

# result of whereis forever or whereis node
export PATH=$PATH:/usr/bin/
# result of whereis node_modules
export NODE_PATH=$NODE_PATH:/usr/lib/node_modules


start(){
        cd /home/ec2-user/yesgo/api-tipo-uber/ && NODE_ENV=yesgo_prod forever --uid api-yesgo -a -c "node --max_old_space_size=8192" start index.js
}

stop(){
        cd /home/ec2-user/yesgo/api-tipo-uber/ && forever stop index.js
}

restart(){
        cd /home/ec2-user/yesgo/api-tipo-uber/ && NODE_ENV=yesgo_prod forever restart index.js
}

case "$1" in
        start)
                echo "Start service SERVICE_NAME"
                start
                ;;
        stop)
                echo "Stop service SERVICE_NAME"
                stop
                ;;
        restart)
                echo "Restart service SERVICE_NAME"
                restart
                ;;
        *)
                echo "Usage: $0 {start|stop|restart}"
                exit 1
                ;;
esac
