#!/bin/sh
# Copyright (c) 2012 Oliver Lau <oliver@von-und-fuer-lau.de>, Heise Zeitschriften Verlag.

if [ -z "$1" ]
then
    echo "Usage: deploy.sh <version>"
    exit 1
fi

VERSION=$1
DIR=uploader2-${VERSION}

echo
echo MAKING DIRECTORIES IN ${DIR} ..
mkdir -p ${DIR}/js
mkdir -p ${DIR}/css
mkdir -p ${DIR}/img

PATHTOYUI=`pwd`/bin
echo COMPRESSING JAVASCRIPTS ..
cd js/src
for f in *.js
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type js --charset utf-8 -o ../../${DIR}/js/$f $f
done

cd ../..

echo COMPRESSING STYLESHEETS ..
cd css/src
for f in *.css
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type css --charset utf-8 -o ../../${DIR}/css/$f $f
done

cd ../..

echo COPYING/CONVERTING FILES ..
cp img/* ${DIR}/img
cp -r css/src ${DIR}/css/src
cp -r js/src ${DIR}/js/src
cp *.php ${DIR}
cp config.json ${DIR}
cp ChangeLog ${DIR}
cp README.txt ${DIR}/README
cp LICENSE.txt ${DIR}/LICENSE
sed -e "s/js\/src/js/" -e "s/css\/src/css/" index.html > ${DIR}/index.html

echo BUILDING ARCHIVE ${DIR}.tar.gz ..
tar -czf ${DIR}.tar.gz ${DIR}/*

echo READY.
